// Banco de teste: PGlite (PostgreSQL em WebAssembly, dentro do processo) com um
// "auth" mínimo no lugar do Supabase Auth. Não é o Supabase: serve para provar
// as regras das migrations (RPCs, restrições, permissões) sem Docker e sem
// conta. Concorrência real (duas conexões) NÃO é coberta: PGlite tem uma só.
//
// PGlite não é dependência do app. Instale fora do projeto e aponte:
//   mkdir ../pg && cd ../pg && npm i @electric-sql/pglite
//   PGLITE_DIR=<essa pasta> node --test supabase/tests/
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export async function loadPglite() {
  const dir = process.env.PGLITE_DIR;
  if (!dir) return null;
  const entry = join(dir, "node_modules/@electric-sql/pglite/dist/index.js");
  return (await import(pathToFileURL(entry).href)).PGlite;
}

export class ApiError extends Error {
  constructor(error) {
    super(error.message);
    this.code = error.code; // PT409 etc. (o PostgREST converte em HTTP 409)
    this.status = /^PT(\d{3})$/.test(error.code) ? Number(error.code.slice(2)) : 500;
  }
}

export async function createDatabase(PGlite) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
  `);
  const dir = join(here, "../migrations");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(join(dir, file), "utf8"));

  const users = new Map();
  const api = {
    db,
    async user(name) {
      if (!users.has(name)) {
        const { rows } = await db.query(
          "insert into auth.users (email) values ($1) returning id",
          [`${name}@teste.dev`],
        );
        users.set(name, rows[0].id);
      }
      return users.get(name);
    },
    email: (name) => `${name}@teste.dev`,
    /** Chama uma função public.app_* como `name` (papel authenticated), como o PostgREST faria. */
    async rpc(name, fn, body = {}, { key } = {}) {
      const id = await api.user(name);
      const headers = key ? JSON.stringify({ "idempotency-key": key }) : "{}";
      await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.headers', $2, false)", [id, headers]);
      await db.exec("set role authenticated");
      try {
        const { rows } = await db.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(body)]);
        const result = rows[0].r;
        if (fn === "app_intent_save" && api.workerOn) {
          await db.exec("reset role");
          await api.drainRoutes();
          await db.exec("set role authenticated");
        }
        return result;
      } catch (error) {
        throw new ApiError(error);
      } finally {
        await db.exec("reset role");
      }
    },
    /** Worker de rotas simulado: resolve a fila com um percurso = linha reta x `factor`. */
    routeFactor: 1,
    workerOn: true,
    async drainRoutes() {
      const { rows } = await db.query("select a_lat, a_lon, b_lat, b_lon from route_queue");
      for (const r of rows) {
        const [la1, lo1, la2, lo2] = [r.a_lat, r.a_lon, r.b_lat, r.b_lon].map(Number);
        const meters = Math.round(straight(la1, lo1, la2, lo2) * api.routeFactor);
        await api.worker("worker_route_store", {
          a: { lat: la1, lon: lo1 }, b: { lat: la2, lon: lo2 }, meters,
          mid: { lat: (la1 + la2) / 2, lon: (lo1 + lo2) / 2 }, provider: "teste",
        });
      }
    },
    /** Chama uma função worker_* como service_role. */
    async worker(fn, body = {}) {
      await db.exec("set role service_role");
      try {
        const { rows } = await db.query(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(body)]);
        return rows[0].r;
      } catch (error) {
        throw new ApiError(error);
      } finally {
        await db.exec("reset role");
      }
    },
    /** SQL como administrador (para montar cenários, ex.: "o tempo passou"). */
    sql: (text, params) => db.query(text, params),
  };
  return api;
}

function straight(la1, lo1, la2, lo2) {
  const rad = (x) => (x * Math.PI) / 180;
  const h = Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const iso = (ms) => new Date(ms).toISOString();
export const H = 3_600_000;

export async function expectError(promise, status) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError && error.status === status) return error;
    throw new Error(`esperava HTTP ${status}, veio ${error.status ?? "?"}: ${error.message}`);
  }
  throw new Error(`esperava HTTP ${status}, mas a chamada funcionou`);
}

// Cenário comum: duas pessoas cadastradas, com busca compatível (300 m entre os
// pontos, mesma hora, limite de caminhada 400 m).
export async function twoWalkers(api, { limitA = 400, limitB = 400, gap = 0.0027 } = {}) {
  const base = { latitude: -19.93, longitude: -43.94 };
  const departure = iso(Date.now() + 3 * H);
  const people = [
    ["ana", limitA, 0],
    ["bruno", limitB, gap],
  ];
  for (const [name, limit, shift] of people) {
    await api.rpc(name, "app_profile_save", {
      profile: { email: api.email(name), name: name[0].toUpperCase() + name.slice(1), phone: "", birth: "1995-04-02", photo: false },
    });
    await api.rpc(name, "app_intent_save", {
      intent: {
        departure, timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: limit,
        origin: `Rua ${name} 10 · Savassi`, destination: `Av. ${name} 200 · Centro`,
        points: {
          origin: { latitude: base.latitude + shift, longitude: base.longitude },
          destination: { latitude: -19.92 + shift, longitude: -43.93 },
        },
      },
    });
  }
}

// Ana pede, Bruno pede de volta: aceite mútuo. Devolve o id da negociação.
export async function match(api) {
  const ana = await api.user("ana");
  const bruno = await api.user("bruno");
  const sa = await api.rpc("ana", "app_state");
  await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: sa.revision });
  const sb = await api.rpc("bruno", "app_state");
  const after = await api.rpc("bruno", "app_request_send", { candidateId: ana, expectedRevision: sb.revision });
  return after.proposal.negotiation;
}

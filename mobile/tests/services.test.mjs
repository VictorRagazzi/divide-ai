import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initialState } from "../src/features/demo/domain.ts";
import {
  createGeocoder,
  readApiPlaces,
} from "../src/features/maps/geocoder.ts";
import { tileImgSrc } from "../src/features/maps/tiles.ts";
import {
  createDemoAuth,
  createMemoryStore,
  createSessionManager,
  createSupabaseAuth,
} from "../src/services/auth.ts";
import {
  endpointNames,
  isTileTemplate,
  parseConfig,
  parseEndpoint,
} from "../src/services/config.ts";
import { readEnv } from "../src/services/env.ts";
import {
  applySnapshot,
  commandRoute,
  createGateway,
  readSnapshot,
  toRequest,
} from "../src/services/gateway.ts";
import { ApiError, createHttpClient } from "../src/services/http.ts";
import { createServices } from "../src/services/index.ts";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const base = "https://api.example.com";
const apiEnv = {
  EXPO_PUBLIC_DATA_SOURCE: "api",
  EXPO_PUBLIC_API_BASE_URL: `${base}/`,
  EXPO_PUBLIC_API_KEY: "public-key",
  EXPO_PUBLIC_API_STATE_GET: "/state",
  EXPO_PUBLIC_API_MESSAGE_SEND: "/rpc/send_message",
  EXPO_PUBLIC_API_INTENT_SAVE: "POST /rest/v1/rpc/save_intent",
};

test(".env.example lists exactly the variables the app reads", async () => {
  const text = await readFile(
    new URL("../.env.example", import.meta.url),
    "utf8",
  );
  const declared = text
    .split(/\r?\n/)
    .filter((line) => /^EXPO_PUBLIC_[A-Z_]+=/.test(line))
    .map((line) => line.split("=")[0])
    .sort();
  assert.deepEqual(declared, Object.keys(readEnv()).sort());
  for (const name of endpointNames)
    assert.ok(declared.includes(`EXPO_PUBLIC_API_${name}`), name);
  // Nenhum segredo conhecido no exemplo do app.
  assert.doesNotMatch(text, /SERVICE_ROLE|RESEND_API_KEY|re_[A-Za-z0-9]{10,}/);
});

test(".env.supabase.example is a valid configuration once the two blanks are filled", async () => {
  const text = await readFile(
    new URL("../.env.supabase.example", import.meta.url),
    "utf8",
  );
  const env = Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^EXPO_PUBLIC_[A-Z_]+=/.test(line))
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
  assert.equal(env.EXPO_PUBLIC_API_BASE_URL, "");
  assert.equal(env.EXPO_PUBLIC_API_KEY, "");
  const filled = parseConfig({
    ...env,
    EXPO_PUBLIC_API_BASE_URL: "https://abcd.supabase.co",
    EXPO_PUBLIC_API_KEY: "chave-publica",
  });
  assert.deepEqual(filled.warnings, []);
  assert.equal(filled.data.source, "api");
  assert.equal(filled.data.endpoints.STATE_GET.method, "POST");
  assert.match(
    filled.data.endpoints.STATE_GET.url,
    /\/rest\/v1\/rpc\/app_state$/,
  );
  for (const name of endpointNames)
    assert.ok(filled.data.endpoints[name], `${name} configurado`);
  // Sem preencher, o app continua na demonstração (padrão seguro).
  assert.equal(parseConfig(env).data.source, "demo");
});

test("empty env keeps the safe demo defaults without warnings", () => {
  const config = parseConfig({});
  assert.equal(config.demo, true);
  assert.equal(config.data.source, "demo");
  assert.equal(config.auth.provider, "demo");
  assert.equal(config.geocoder.provider, "photon");
  assert.equal(config.geocoder.baseUrl, "https://photon.komoot.io");
  assert.equal(config.geocoder.intervalMs, 1200);
  assert.equal(
    config.map.tileUrl,
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  );
  assert.equal(config.map.maxZoom, 19);
  assert.deepEqual(config.warnings, []);
  assert.deepEqual(config.data.endpoints, {});
  // Valores vazios (como no .env copiado do exemplo) equivalem a ausentes.
  assert.deepEqual(
    parseConfig({ EXPO_PUBLIC_API_BASE_URL: "", EXPO_PUBLIC_DATA_SOURCE: "" }),
    config,
  );
});

test("api mode resolves endpoints against the base URL", () => {
  const config = parseConfig(apiEnv);
  assert.equal(config.demo, false);
  assert.equal(config.data.baseUrl, base);
  assert.deepEqual(config.data.endpoints.STATE_GET, {
    method: "GET",
    url: `${base}/state`,
  });
  assert.deepEqual(config.data.endpoints.MESSAGE_SEND, {
    method: "POST",
    url: `${base}/rpc/send_message`,
  });
  assert.deepEqual(config.data.endpoints.INTENT_SAVE, {
    method: "POST",
    url: `${base}/rest/v1/rpc/save_intent`,
  });
  assert.match(
    config.warnings.join("\n"),
    /Endpoints sem configuração: .*PROFILE_SAVE/,
  );
});

test("invalid configuration never breaks the app: it falls back and warns", () => {
  const noBase = parseConfig({ EXPO_PUBLIC_DATA_SOURCE: "api" });
  assert.equal(noBase.demo, true);
  assert.match(noBase.warnings.join(), /API_BASE_URL/);
  assert.equal(parseConfig({ EXPO_PUBLIC_DATA_SOURCE: "banana" }).demo, true);
  // http fora de rede local, credenciais na URL e esquemas estranhos são recusados.
  for (const bad of [
    "http://api.example.com",
    "https://u:p@api.example.com",
    "ftp://x.com",
    "javascript:alert(1)",
    "não é url",
  ])
    assert.equal(
      parseConfig({
        EXPO_PUBLIC_DATA_SOURCE: "api",
        EXPO_PUBLIC_API_BASE_URL: bad,
      }).demo,
      true,
      bad,
    );
  for (const ok of [
    "http://localhost:54321",
    "http://10.0.2.2:3000",
    "http://192.168.0.10:8000",
    "https://x.supabase.co",
  ])
    assert.equal(
      parseConfig({
        EXPO_PUBLIC_DATA_SOURCE: "api",
        EXPO_PUBLIC_API_BASE_URL: ok,
      }).demo,
      false,
      ok,
    );
  const config = parseConfig({
    ...apiEnv,
    EXPO_PUBLIC_API_STATE_GET: "//evil.example.com/x",
    EXPO_PUBLIC_API_POLL_MS: "abc",
    EXPO_PUBLIC_API_TIMEOUT_MS: "5",
  });
  assert.equal(config.data.endpoints.STATE_GET, undefined);
  assert.match(config.warnings.join(), /API_STATE_GET inválido/);
  assert.equal(config.data.pollMs, 5000);
  assert.equal(config.data.timeoutMs, 15000);
  assert.equal(
    parseConfig({ ...apiEnv, EXPO_PUBLIC_API_POLL_MS: "0" }).data.pollMs,
    0,
  );
});

test("endpoint specs accept method prefixes, relative paths and https URLs", () => {
  assert.deepEqual(parseEndpoint("get /a", base, "POST"), {
    method: "GET",
    url: `${base}/a`,
  });
  assert.deepEqual(parseEndpoint("/a?x=1", base, "GET"), {
    method: "GET",
    url: `${base}/a?x=1`,
  });
  assert.deepEqual(
    parseEndpoint("PATCH https://other.example.com/p", null, "GET"),
    {
      method: "PATCH",
      url: "https://other.example.com/p",
    },
  );
  assert.equal(parseEndpoint("", base, "GET"), null);
  assert.equal(parseEndpoint("/a", null, "GET"), "invalid");
  assert.equal(
    parseEndpoint("http://evil.example.com/a", base, "GET"),
    "invalid",
  );
});

test("supabase auth needs URL and public key, else stays on demo login", () => {
  assert.equal(
    parseConfig({ EXPO_PUBLIC_AUTH_PROVIDER: "supabase" }).auth.provider,
    "demo",
  );
  const config = parseConfig({
    EXPO_PUBLIC_AUTH_PROVIDER: "supabase",
    EXPO_PUBLIC_AUTH_BASE_URL: "https://x.supabase.co/",
    EXPO_PUBLIC_API_KEY: "anon",
  });
  assert.equal(config.auth.provider, "supabase");
  assert.equal(config.auth.baseUrl, "https://x.supabase.co");
  assert.equal(config.demo, true); // dados continuam demo
});

test("map tile template is validated and drives the CSP origin", () => {
  assert.equal(
    isTileTemplate("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
    true,
  );
  assert.equal(
    isTileTemplate("https://{s}.tile.example.com/{z}/{x}/{y}{r}.png?key=abc"),
    true,
  );
  for (const bad of [
    "http://tile.example.com/{z}/{x}/{y}.png",
    "https://tile.example.com/{z}/{x}.png",
    'https://tile.example.com/{z}/{x}/{y}.png"onload="x',
    "https://tile.example.com/{z}/{x}/{y}.png<script>",
    "javascript:alert(1)//{z}{x}{y}",
  ])
    assert.equal(isTileTemplate(bad), false, bad);
  const config = parseConfig({
    EXPO_PUBLIC_MAP_TILE_URL: "http://insecure.example.com/{z}/{x}/{y}.png",
    EXPO_PUBLIC_MAP_ATTRIBUTION_URL: "http://insecure.example.com",
  });
  assert.equal(
    config.map.tileUrl,
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  );
  assert.equal(
    config.map.attributionUrl,
    "https://www.openstreetmap.org/copyright",
  );
  assert.equal(config.warnings.length, 2);
  assert.equal(
    tileImgSrc("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
    "https://tile.openstreetmap.org",
  );
  assert.equal(
    tileImgSrc("https://{s}.tile.example.com/{z}/{x}/{y}.png"),
    "https://*.tile.example.com",
  );
  assert.equal(
    tileImgSrc("https://tiles-{s}.example.com/{z}/{x}/{y}.png"),
    "https:",
  );
  assert.equal(
    tileImgSrc("https://t.example.com:8443/{z}/{x}/{y}.png?key=1"),
    "https://t.example.com:8443",
  );
});

test("http client sends auth, key and idempotency headers and maps errors", async () => {
  const calls = [];
  const client = createHttpClient({
    timeoutMs: 1000,
    apiKey: "public-key",
    getToken: () => "tok",
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return json({ ok: true });
    },
  });
  const result = await client.request(
    { method: "POST", url: `${base}/x?a=1` },
    { body: { n: 1 }, idempotencyKey: "k1", query: { b: 2, skip: undefined } },
  );
  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, `${base}/x?a=1&b=2`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body, '{"n":1}');
  assert.equal(calls[0].init.headers.apikey, "public-key");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok");
  assert.equal(calls[0].init.headers["Idempotency-Key"], "k1");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");

  const failing = (status, body = {}) =>
    createHttpClient({
      timeoutMs: 1000,
      fetcher: async () => json(body, status),
    });
  for (const [status, pattern] of [
    [401, /sessão expirou/],
    [403, /permissão/],
    [409, /mudou/],
    [422, /Confira os dados/],
    [429, /Muitas tentativas/],
    [503, /indisponível/],
  ]) {
    const error = await failing(status, { message: "SECRET internal detail" })
      .request({ method: "GET", url: base })
      .catch((e) => e);
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, status);
    assert.match(error.message, pattern);
    assert.doesNotMatch(error.message, /SECRET/); // detalhe do servidor não vai para a tela
  }
  const noContent = createHttpClient({
    timeoutMs: 1000,
    fetcher: async () => new Response(null, { status: 204 }),
  });
  assert.deepEqual(await noContent.request({ method: "POST", url: base }), {});
  const html = createHttpClient({
    timeoutMs: 1000,
    fetcher: async () => new Response("<html>", { status: 200 }),
  });
  await assert.rejects(
    html.request({ method: "GET", url: base }),
    (e) => e.status === 502,
  );
});

test("http client retries only what is safe to repeat", async () => {
  const flaky = (counter) => async () => {
    counter.n++;
    if (counter.n === 1) throw new TypeError("Failed to fetch");
    return json({ done: true });
  };
  const get = { n: 0 };
  const client = createHttpClient({ timeoutMs: 1000, fetcher: flaky(get) });
  assert.deepEqual(await client.request({ method: "GET", url: base }), {
    done: true,
  });
  assert.equal(get.n, 2);
  const unsafe = { n: 0 };
  const postClient = createHttpClient({
    timeoutMs: 1000,
    fetcher: flaky(unsafe),
  });
  await assert.rejects(
    postClient.request({ method: "POST", url: base }, { body: {} }),
    /Sem conexão/,
  );
  assert.equal(unsafe.n, 1); // POST sem chave de idempotência não é repetido
  const keyed = { n: 0 };
  const keyedClient = createHttpClient({
    timeoutMs: 1000,
    fetcher: flaky(keyed),
  });
  await keyedClient.request(
    { method: "POST", url: base },
    { body: {}, idempotencyKey: "k" },
  );
  assert.equal(keyed.n, 2);
});

test("http client times out and supports caller cancellation", async () => {
  const hang = (_, init) =>
    new Promise((_, reject) =>
      init.signal.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      ),
    );
  const client = createHttpClient({ timeoutMs: 10, fetcher: hang });
  await assert.rejects(
    client.request({ method: "POST", url: base }, { body: {} }),
    /demorou/,
  );
  const controller = new AbortController();
  const slow = createHttpClient({ timeoutMs: 5000, fetcher: hang });
  const pending = slow.request(
    { method: "POST", url: base },
    { body: {}, signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, (error) => error.name === "AbortError");
});

test("401 triggers one refresh and a retry with the new token", async () => {
  let token = "old";
  const seen = [];
  const client = createHttpClient({
    timeoutMs: 1000,
    getToken: () => token,
    onUnauthorized: async () => {
      token = "new";
      return true;
    },
    fetcher: async (_, init) => {
      seen.push(init.headers.Authorization);
      return seen.length === 1 ? json({}, 401) : json({ ok: 1 });
    },
  });
  assert.deepEqual(await client.request({ method: "GET", url: base }), {
    ok: 1,
  });
  assert.deepEqual(seen, ["Bearer old", "Bearer new"]);
});

const instant = Date.parse("2026-10-12T21:00:00Z");
const intent = {
  departure: instant,
  timeZone: "America/Sao_Paulo",
  fixed: false,
  passengers: 1,
  walkingLimit: 400,
  origin: "Rua A",
  destination: "Rua B",
  points: {
    origin: { latitude: -19.93, longitude: -43.93 },
    destination: { latitude: -19.92, longitude: -43.94 },
  },
};

test("commands are routed to local, remote or demo-only", () => {
  assert.equal(commandRoute({ type: "tick" }), "local");
  assert.equal(commandRoute({ type: "sign-out" }), "local");
  assert.equal(
    commandRoute({ type: "start", intent, candidates: [] }),
    "remote",
  );
  assert.equal(commandRoute({ type: "simulate-match" }), "demo-only");
  assert.equal(commandRoute({ type: "end-trip", negotiation: 1 }), "demo-only");
  assert.equal(
    commandRoute({
      type: "pick",
      who: "theirs",
      choice: "mine",
      negotiation: 1,
      expectedVersion: 1,
    }),
    "demo-only",
  );
  assert.equal(
    commandRoute({
      type: "pick",
      who: "mine",
      choice: "mine",
      negotiation: 1,
      expectedVersion: 1,
    }),
    "remote",
  );
  assert.equal(
    commandRoute({
      type: "chat",
      sender: "theirs",
      text: "oi",
      negotiation: 1,
    }),
    "demo-only",
  );
  // Todo comando remoto tem rota configurável; nenhum local/demo-only tem.
  const remote = [
    { type: "start", intent, candidates: [] },
    {
      type: "save-profile",
      profile: {
        email: "a@b.co",
        name: "A",
        phone: "",
        birth: "2000-01-01",
        photo: false,
      },
    },
    { type: "request", id: "c1", expectedRevision: 2 },
    { type: "decline", id: "c1" },
    { type: "cancel" },
    { type: "cancel-search" },
    {
      type: "pick",
      who: "mine",
      choice: "stop",
      stop: "Praça",
      negotiation: 1,
      expectedVersion: 2,
    },
    { type: "chat", sender: "mine", text: "oi", negotiation: 1 },
    { type: "cancel-negotiation", negotiation: 1 },
    {
      type: "trip-happened",
      negotiation: 1,
      happened: false,
      reason: "no-show",
    },
    { type: "rate", negotiation: 1, stars: 4, comment: " ótima " },
    { type: "close-trip", negotiation: 1 },
    { type: "report", companion: "c1", reason: "other", details: " x " },
    { type: "block", companion: "c1" },
    { type: "unblock", companion: "c1" },
  ];
  const names = remote.map((command) => {
    const request = toRequest(command);
    assert.ok(request, command.type);
    assert.ok(endpointNames.includes(request.endpoint), request.endpoint);
    return request.endpoint;
  });
  assert.equal(new Set(names).size, endpointNames.length - 4); // todas as escritas, 1 a 1
  assert.equal(toRequest({ type: "tick" }), null);
  assert.equal(toRequest({ type: "simulate-match" }), null);
});

test("request bodies carry UTC instants, expected versions and trimmed text", () => {
  const start = toRequest({
    type: "start",
    intent,
    candidates: [{ id: "demo" }],
  });
  assert.equal(start.body.intent.departure, "2026-10-12T21:00:00.000Z");
  assert.equal(start.body.candidates, undefined); // candidatos vêm do servidor
  assert.deepEqual(
    toRequest({ type: "request", id: "c1", expectedRevision: 3 }).body,
    { candidateId: "c1", expectedRevision: 3 },
  );
  assert.deepEqual(
    toRequest({
      type: "request",
      id: "c1",
      expectedRevision: 3,
      declineIncoming: true,
    }).body,
    { candidateId: "c1", expectedRevision: 3, declineIncoming: true },
  );
  assert.deepEqual(toRequest({ type: "decline", id: "c1" }).body, {
    candidateId: "c1",
  });
  assert.deepEqual(
    toRequest({
      type: "pick",
      who: "mine",
      choice: "stop",
      stop: "Praça",
      negotiation: 7,
      expectedVersion: 2,
    }).body,
    { negotiation: 7, expectedVersion: 2, choice: "stop", stop: "Praça" },
  );
  assert.equal(
    toRequest({ type: "rate", negotiation: 1, stars: 4, comment: " ótima " })
      .body.comment,
    "ótima",
  );
});

const snapshot = {
  profile: {
    email: "a@b.co",
    name: "Ana",
    phone: "",
    birth: "2000-01-01",
    photo: false,
  },
  intent: { ...intent, departure: "2026-10-12T21:00:00Z" },
  candidates: [
    {
      id: "c1",
      name: "Bruno",
      departure: "2026-10-12T21:05:00Z",
      fixed: false,
      passengers: 1,
      walkingLimit: 400,
      pickup: 120,
      dropoff: 90,
      companionPickup: 100,
      companionDropoff: 80,
      rating: "4.8",
      trips: 12,
    },
  ],
  pending: "c1",
  matched: null,
  revision: 4,
  proposal: {
    negotiation: 9,
    version: 1,
    picks: { mine: { choice: "suggestion" }, theirs: null },
    pickup: "A",
    dropoff: "B",
    departure: instant,
    stops: ["Praça"],
    walks: [1, 2, 3, 4],
  },
  messages: [
    { id: 1, sender: "theirs", text: "oi", at: "2026-10-12T21:01:00Z" },
  ],
  postTrip: null,
  history: [],
  blocked: ["c9"],
  reports: [{ companion: "c9", reason: "unsafe", details: "", at: instant }],
  unknownKey: "ignored",
};

test("snapshots are validated and instants normalised to milliseconds", () => {
  const read = readSnapshot(snapshot);
  assert.equal(read.intent.departure, instant);
  assert.equal(read.candidates[0].departure, instant + 5 * 60_000);
  assert.equal(read.messages[0].at, instant + 60_000);
  assert.equal(read.unknownKey, undefined);
  assert.deepEqual(Object.keys(readSnapshot({ messages: [] })), ["messages"]);
  assert.deepEqual(readSnapshot({}), {});
  // Estado devolvido nunca derruba o app: resposta inválida vira erro tratável.
  for (const broken of [
    null,
    [],
    { candidates: "x" },
    { candidates: [{ id: "c1" }] },
    { messages: [{ id: 1, sender: "admin", text: "x", at: 1 }] },
    { proposal: { ...snapshot.proposal, walks: [1, 2] } },
    {
      proposal: {
        ...snapshot.proposal,
        picks: { mine: { choice: "hack" }, theirs: null },
      },
    },
    {
      intent: {
        ...snapshot.intent,
        points: {
          origin: { latitude: 999, longitude: 0 },
          destination: snapshot.intent.points.destination,
        },
      },
    },
    { revision: 1.5 },
    { messages: [{ id: 1, sender: "mine", text: "x".repeat(2001), at: 1 }] },
  ])
    assert.throws(
      () => readSnapshot(broken),
      (e) => e instanceof ApiError && e.status === 502,
      JSON.stringify(broken)?.slice(0, 60),
    );
  const next = applySnapshot(
    { ...initialState, session: "a@b.co" },
    readSnapshot({ blocked: ["c9"], session: "hack" }),
  );
  assert.equal(next.session, "a@b.co");
  assert.deepEqual(next.blocked, ["c9"]);
});

test("gateway executes commands against configured endpoints", async () => {
  const config = parseConfig(apiEnv);
  const calls = [];
  const services = createServices(config, {
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return json({ messages: snapshot.messages });
    },
  });
  assert.ok(services.gateway);
  const result = await services.gateway.execute(
    { type: "chat", sender: "mine", text: "olá", negotiation: 9 },
    "key-1",
  );
  assert.equal(result.messages[0].text, "oi");
  assert.equal(calls[0].url, `${base}/rpc/send_message`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    negotiation: 9,
    text: "olá",
  });
  assert.equal(calls[0].init.headers["Idempotency-Key"], "key-1");
  assert.equal(calls[0].init.headers.apikey, "public-key");
  // Endpoint não configurado: erro claro, sem chamada de rede.
  await assert.rejects(
    services.gateway.execute({ type: "block", companion: "c1" }),
    (e) => e.status === 501 && /não está configurado/.test(e.message),
  );
  assert.equal(calls.length, 1);
  // Comando que não vai ao servidor é recusado.
  await assert.rejects(
    services.gateway.execute({ type: "tick" }),
    (e) => e.status === 400,
  );
});

test("gateway reads the state, falling back when a partial read is not configured", async () => {
  const calls = [];
  const http = createHttpClient({
    timeoutMs: 1000,
    fetcher: async (url, init) => {
      calls.push({ url, init });
      return json({ blocked: ["c9"] });
    },
  });
  const endpoints = parseConfig({
    ...apiEnv,
    EXPO_PUBLIC_API_MESSAGES_GET: "/chat",
  }).data.endpoints;
  const gateway = createGateway({ http, endpoints });
  assert.deepEqual(await gateway.read("messages", { negotiation: 9 }), {
    blocked: ["c9"],
  });
  assert.equal(calls[0].url, `${base}/chat?negotiation=9`);
  await gateway.read("candidates"); // sem CANDIDATES_GET → usa STATE_GET
  assert.equal(calls[1].url, `${base}/state`);
  // Leitura em POST (RPC) manda os parâmetros no corpo.
  const rpc = createGateway({
    http,
    endpoints: parseConfig({
      ...apiEnv,
      EXPO_PUBLIC_API_STATE_GET: "POST /rpc/state",
    }).data.endpoints,
  });
  await rpc.read("state");
  assert.equal(calls[2].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[2].init.body), { resource: "state" });
});

test("demo auth accepts only the demo code and never sends anything", async () => {
  const auth = createDemoAuth();
  await auth.requestCode("a@b.co");
  const session = await auth.verifyCode(" A@B.co ", "123 456");
  assert.equal(session.email, "a@b.co");
  await assert.rejects(auth.verifyCode("a@b.co", "000000"), (e) =>
    /incorreto/.test(e.message),
  );
});

test("supabase auth talks to GoTrue REST with the public key only", async () => {
  const calls = [];
  const replies = [
    json({}),
    json({
      access_token: "A",
      refresh_token: "R",
      expires_in: 3600,
      user: { email: "Ana@B.co" },
    }),
    json({ access_token: "A2", refresh_token: "R2", expires_in: 3600 }),
    new Response(null, { status: 204 }),
  ];
  const auth = createSupabaseAuth(
    "https://x.supabase.co",
    "anon-key",
    async (url, init) => {
      calls.push({ url, init });
      return replies.shift();
    },
  );
  await auth.requestCode(" Ana@B.co ");
  assert.equal(calls[0].url, "https://x.supabase.co/auth/v1/otp");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    email: "ana@b.co",
    create_user: true,
  });
  assert.equal(calls[0].init.headers.apikey, "anon-key");
  const session = await auth.verifyCode("ana@b.co", "123 456");
  assert.equal(calls[1].url, "https://x.supabase.co/auth/v1/verify");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    type: "email",
    email: "ana@b.co",
    token: "123456",
  });
  assert.equal(session.accessToken, "A");
  assert.equal(session.email, "ana@b.co");
  assert.ok(session.expiresAt > Date.now());
  const renewed = await auth.refresh(session);
  assert.equal(
    calls[2].url,
    "https://x.supabase.co/auth/v1/token?grant_type=refresh_token",
  );
  assert.deepEqual(JSON.parse(calls[2].init.body), { refresh_token: "R" });
  assert.equal(renewed.accessToken, "A2");
  assert.equal(renewed.email, "ana@b.co");
  await auth.signOut(renewed);
  assert.equal(calls[3].url, "https://x.supabase.co/auth/v1/logout");
  assert.equal(calls[3].init.headers.Authorization, "Bearer A2");
});

test("supabase auth turns server failures into friendly Portuguese messages", async () => {
  const make = (status, body = {}) =>
    createSupabaseAuth("https://x.supabase.co", "k", async () =>
      json(body, status),
    );
  await assert.rejects(
    make(403, { error_code: "otp_expired" }).verifyCode("a@b.co", "123456"),
    /incorreto ou expirado/,
  );
  await assert.rejects(make(429).requestCode("a@b.co"), /Muitas tentativas/);
  await assert.rejects(make(500).requestCode("a@b.co"), /indisponível/);
  await assert.rejects(
    make(200, { user: {} }).verifyCode("a@b.co", "123456"),
    (e) => e.status === 502,
  );
  const offline = createSupabaseAuth("https://x.supabase.co", "k", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(offline.requestCode("a@b.co"), /Sem conexão/);
});

test("session manager stores, restores, refreshes once and signs out", async () => {
  let refreshes = 0;
  let loggedOut = 0;
  const auth = {
    kind: "supabase",
    requestCode: async () => {},
    verifyCode: async (email) => ({
      email,
      accessToken: "t1",
      refreshToken: "r1",
      expiresAt: Date.now() + 3_600_000,
    }),
    refresh: async (session) => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ...session, accessToken: `t${refreshes + 1}` };
    },
    signOut: async () => {
      loggedOut++;
    },
  };
  const store = createMemoryStore();
  const manager = createSessionManager(auth, store);
  assert.equal(manager.getAccessToken(), null);
  await manager.signIn("a@b.co", "123456");
  assert.equal(manager.getAccessToken(), "t1");
  assert.equal((await store.load()).email, "a@b.co");
  const [a, b] = await Promise.all([manager.refresh(), manager.refresh()]);
  assert.deepEqual([a, b, refreshes], [true, true, 1]); // chamadas simultâneas compartilham uma renovação
  assert.equal(manager.getAccessToken(), "t2");
  // Restaurar: sessão perto de vencer é renovada; falha na renovação descarta.
  const expiring = createMemoryStore();
  await expiring.save({
    email: "a@b.co",
    accessToken: "old",
    refreshToken: "r",
    expiresAt: Date.now() + 1000,
  });
  const restoring = createSessionManager(auth, expiring);
  assert.equal((await restoring.restore()).accessToken, "t3");
  assert.equal(refreshes, 2);
  const broken = createSessionManager(
    {
      ...auth,
      refresh: async () => {
        throw new ApiError(401, "x");
      },
    },
    expiring,
  );
  assert.equal(await broken.restore(), null);
  assert.equal(await expiring.load(), null);
  await manager.signOut();
  assert.equal(manager.get(), null);
  assert.equal(loggedOut, 1);
  assert.equal(await store.load(), null);
});

test("geocoder talks to a custom backend with auth headers and no Photon-only params", async () => {
  const calls = [];
  const client = createGeocoder({
    intervalMs: 0,
    searchUrl: `${base}/places/search`,
    reverseUrl: `${base}/places/reverse`,
    parse: readApiPlaces,
    fixedParams: {},
    headers: () => ({ apikey: "public-key", Authorization: "Bearer tok" }),
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return json({
        places: [
          {
            title: "Rua da Bahia, 1200",
            detail: "Centro · Belo Horizonte",
            latitude: -19.93,
            longitude: -43.93,
          },
          { title: "Duplicado", latitude: 999, longitude: 0 },
          { title: "", latitude: -19.9, longitude: -43.9 },
        ],
      });
    },
  });
  const places = await client.search("Rua da Bahia");
  assert.equal(places.length, 1);
  assert.equal(places[0].label, "Rua da Bahia, 1200 · Centro · Belo Horizonte");
  const url = new URL(calls[0].url);
  assert.equal(url.origin + url.pathname, `${base}/places/search`);
  assert.equal(url.searchParams.get("q"), "Rua da Bahia");
  assert.equal(url.searchParams.has("lang"), false);
  assert.equal(calls[0].init.headers.apikey, "public-key");
  await client.reverse({ latitude: -19.93, longitude: -43.93 });
  assert.equal(new URL(calls[1].url).searchParams.get("lat"), "-19.93");
  assert.deepEqual(readApiPlaces({ places: "x" }), []);
  assert.deepEqual(readApiPlaces(null), []);
});

test("createServices wires the geocoder provider and keeps the demo gateway off", async () => {
  const demo = createServices(parseConfig({}));
  assert.equal(demo.gateway, null);
  assert.equal(demo.auth.kind, "demo");
  const calls = [];
  const wired = createServices(
    parseConfig({
      ...apiEnv,
      EXPO_PUBLIC_GEOCODER_PROVIDER: "api",
      EXPO_PUBLIC_GEOCODER_SEARCH: "/places/search",
      EXPO_PUBLIC_GEOCODER_REVERSE: "/places/reverse",
    }),
    {
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init });
        return json({ places: [] });
      },
    },
  );
  await wired.geocoder.search("Rua da Bahia");
  assert.equal(new URL(calls[0].url).pathname, "/places/search");
  assert.equal(calls[0].init.headers.apikey, "public-key");
  // Photon público: sem cabeçalhos extras (evita preflight CORS).
  const photonCalls = [];
  const photon = createServices(parseConfig({}), {
    fetcher: async (url, init) => {
      photonCalls.push({ url: String(url), init });
      return json({ features: [] });
    },
  });
  await photon.geocoder.search("Rua da Bahia");
  assert.match(photonCalls[0].url, /^https:\/\/photon\.komoot\.io\/api\/\?/);
  assert.equal(photonCalls[0].init.headers, undefined);
});

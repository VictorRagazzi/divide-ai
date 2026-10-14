import assert from "node:assert/strict";
import { test } from "node:test";
import { haversine, midpoint, processBatch, providers } from "../worker/routes.mjs";

const json = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test("ponto do meio fica na metade do percurso, não da linha reta", () => {
  // percurso em L: ~1 km para leste, ~1 km para norte; a metade é a quina.
  const east = [-43.94 + 0.00946, -19.93];
  const path = [[-43.94, -19.93], east, [east[0], -19.93 + 0.00899]];
  const mid = midpoint(path);
  assert.ok(haversine([mid.lon, mid.lat], east) < 30, "perto da quina");
  assert.equal(midpoint([[1, 1]]), null);
});

test("OSRM e ORS: leitura das respostas; erros viram falha, não rota", async () => {
  const a = { lat: -19.93, lon: -43.94 };
  const b = { lat: -19.92, lon: -43.93 };
  const coordinates = [[-43.94, -19.93], [-43.93, -19.92]];
  const osrm = providers.osrm({
    baseUrl: "http://r",
    fetcher: async (url) => {
      assert.match(url, /\/route\/v1\/foot\/-43\.94,-19\.93;-43\.93,-19\.92\?/);
      return json({ code: "Ok", routes: [{ distance: 1500.4, geometry: { coordinates } }] });
    },
  });
  assert.equal((await osrm(a, b)).meters, 1500.4);
  const noRoute = providers.osrm({ baseUrl: "http://r", fetcher: async () => json({ code: "NoRoute", routes: [] }) });
  await assert.rejects(noRoute(a, b), /sem rota/);
  const ors = providers.ors({
    baseUrl: "http://o",
    apiKey: "k",
    fetcher: async (_url, init) => {
      assert.equal(init.headers.Authorization, "k");
      assert.deepEqual(JSON.parse(init.body).coordinates, coordinates);
      return json({ features: [{ properties: { summary: { distance: 900 } }, geometry: { coordinates } }] });
    },
  });
  assert.equal((await ors(a, b)).meters, 900);
  const down = providers.ors({ baseUrl: "http://o", apiKey: "k", fetcher: async () => json({}, false, 429) });
  await assert.rejects(down(a, b), /429/);
});

test("lote grava o que deu certo e registra falha do resto", async () => {
  const calls = [];
  const rpc = async (name, body) => {
    calls.push([name, body]);
    if (name === "worker_route_pending")
      return [1, 2].map((n) => ({ a: { lat: -19.93, lon: -43.94 }, b: { lat: -19.93 + n / 1000, lon: -43.94 } }));
    return {};
  };
  let n = 0;
  const route = async () => {
    if (++n === 2) throw new Error("cota");
    return { meters: 123.6, coordinates: [[-43.94, -19.93], [-43.94, -19.929]] };
  };
  const result = await processBatch({ rpc, route, sleep: async () => {} });
  assert.deepEqual(result, { stored: 1, failed: 1 });
  const stored = calls.find(([name]) => name === "worker_route_store")[1];
  assert.equal(stored.meters, 124);
  assert.ok(Number.isFinite(stored.mid.lat));
  assert.equal(calls.find(([name]) => name === "worker_route_fail")[1].error, "cota");
});

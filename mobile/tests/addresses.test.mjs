import assert from "node:assert/strict";
import test from "node:test";
import { parseSearch } from "../src/features/demo/domain.ts";
import {
  createGeocoder,
  pointLabel,
  readPlaces,
} from "../src/features/maps/geocoder.ts";
import { initialPoints } from "../src/features/maps/model.ts";
import {
  changePlace,
  confirmedTrip,
  emptyPlaces,
} from "../src/features/maps/places.ts";

const feature = {
  geometry: { type: "Point", coordinates: [-43.938, -19.932] },
  properties: {
    osm_type: "W",
    osm_id: 1,
    street: "Rua da Bahia",
    housenumber: "1200",
    district: "Centro",
    city: "Belo Horizonte",
    state: "Minas Gerais",
  },
};
const data = { features: [feature] };
const success = () => new Response(JSON.stringify(data), { status: 200 });
test("addresses include street, number and city, without displaying coordinates", () => {
  const places = readPlaces(data);
  assert.equal(places[0].title, "Rua da Bahia, 1200");
  assert.match(places[0].detail, /Centro.*Belo Horizonte/);
  assert.deepEqual(places[0].point, initialPoints.origin);
  assert.doesNotMatch(places[0].label, /-43|latitude|longitude/);
  assert.deepEqual(
    readPlaces({
      features: [{ ...feature, geometry: { coordinates: [999, 999] } }],
    }),
    [],
  );
  assert.deepEqual(readPlaces(null), []);
});
test("typing invalidates a selected location and old reverse results", () => {
  let state = changePlace(emptyPlaces, {
    type: "select",
    endpoint: "origin",
    place: readPlaces(data)[0],
  });
  const revision = state.origin.revision;
  state = changePlace(state, {
    type: "edit",
    endpoint: "origin",
    text: "Savassi",
  });
  const edited = state;
  state = changePlace(state, {
    type: "resolve",
    endpoint: "origin",
    revision,
    label: "Old GPS street",
  });
  assert.equal(state, edited);
  assert.equal(state.origin.place, null);
  assert.equal(state.origin.text, "Savassi");
  assert.equal(confirmedTrip(state), null);
});
test("reverse preserves exact pin and never labels a nearby POI as pickup", () => {
  const poi = readPlaces({
    features: [
      {
        ...feature,
        properties: {
          name: "Café vizinho",
          district: "Centro",
          city: "Belo Horizonte",
        },
      },
    ],
  })[0];
  assert.equal(
    pointLabel(poi, "Ponto escolhido no mapa"),
    "Ponto escolhido no mapa · Centro · Belo Horizonte",
  );
  let state = changePlace(emptyPlaces, {
    type: "select",
    endpoint: "origin",
    place: { label: "Minha localização", point: initialPoints.origin },
  });
  state = changePlace(state, {
    type: "resolve",
    endpoint: "origin",
    revision: state.origin.revision,
    label: pointLabel(readPlaces(data)[0], "Minha localização"),
  });
  assert.deepEqual(state.origin.place.point, initialPoints.origin);
});
test("same street name can have different points; same point is rejected", () => {
  let state = changePlace(emptyPlaces, {
    type: "select",
    endpoint: "origin",
    place: { label: "Rua da Bahia", point: initialPoints.origin },
  });
  state = changePlace(state, {
    type: "select",
    endpoint: "destination",
    place: { label: "Rua da Bahia", point: initialPoints.destination },
  });
  const trip = confirmedTrip(state);
  assert.ok(trip);
  const future = new Date(Date.now() + 86400000);
  const fields = {
    origin: trip.origin,
    destination: trip.destination,
    date: `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`,
    time: "18:00",
    fixed: false,
    passengers: "1",
    walkingLimit: "400",
  };
  assert.ok(parseSearch(fields, Date.now(), trip.points).intent);
  state = changePlace(state, {
    type: "select",
    endpoint: "destination",
    place: { label: "Outro rótulo", point: initialPoints.origin },
  });
  assert.equal(confirmedTrip(state), null);
});
test("geocoder encodes query, uses local language and caches only successful results", async () => {
  const urls = [];
  const client = createGeocoder({
    intervalMs: 0,
    fetcher: async (url) => {
      urls.push(String(url));
      return success();
    },
  });
  await client.search("Rua & bairro, Belo Horizonte");
  await client.search("Rua & bairro, Belo Horizonte");
  assert.equal(urls.length, 1);
  const params = new URL(urls[0]).searchParams;
  assert.equal(params.get("q"), "Rua & bairro, Belo Horizonte");
  assert.equal(params.get("lang"), "default");
  assert.deepEqual(await client.search("ab"), []);
});
test("cancelled queued lookup never fetches and does not stop following requests", async () => {
  let release;
  let started;
  const start = new Promise((resolve) => {
    started = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const urls = [];
  const client = createGeocoder({
    intervalMs: 0,
    fetcher: async (url) => {
      urls.push(String(url));
      if (urls.length === 1) {
        started();
        await gate;
      }
      return success();
    },
  });
  const first = client.search("Primeira rua");
  await start;
  const controller = new AbortController();
  const old = client.search("Consulta antiga", controller.signal);
  const rejected = assert.rejects(old, { name: "AbortError" });
  controller.abort();
  release();
  await first;
  await rejected;
  await client.search("Nova rua");
  assert.equal(urls.length, 2);
  assert.equal(new URL(urls[1]).searchParams.get("q"), "Nova rua");
});
test("empty results, rate limit and timeouts are recoverable without automatic retries", async () => {
  const empty = createGeocoder({
    intervalMs: 0,
    fetcher: async () => new Response('{"features":[]}', { status: 200 }),
  });
  assert.deepEqual(await empty.search("Rua inexistente"), []);
  let calls = 0;
  const busy = createGeocoder({
    intervalMs: 0,
    fetcher: async () => {
      calls++;
      return new Response("", { status: 429 });
    },
  });
  await assert.rejects(busy.search("Rua da Bahia"), /ocupada/);
  assert.equal(calls, 1);
  const slow = createGeocoder({
    intervalMs: 0,
    timeoutMs: 5,
    fetcher: async (_, options) =>
      new Promise((_, reject) => {
        options.signal.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      }),
  });
  await assert.rejects(slow.search("Rua lenta"), /demorou/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import {
  demoCandidates,
  initialState,
  transition,
} from "../src/features/demo/domain.ts";
import {
  initialPoints,
  isPoint,
  mapUpdate,
  readMessage,
} from "../src/features/maps/model.ts";

test("bridge accepts finite Mercator coordinates and rejects malformed messages", () => {
  assert.equal(isPoint(initialPoints.origin), true);
  for (const point of [
    null,
    {},
    { latitude: "0", longitude: 0 },
    { latitude: NaN, longitude: 0 },
    { latitude: 90, longitude: 0 },
    { latitude: 0, longitude: 181 },
  ])
    assert.equal(isPoint(point), false);
  const valid = {
    type: "selection",
    endpoint: "origin",
    point: initialPoints.origin,
  };
  assert.deepEqual(readMessage(JSON.stringify(valid)), valid);
  for (const value of [
    null,
    "{",
    "null",
    "a".repeat(513),
    JSON.stringify({ ...valid, endpoint: "unknown" }),
    JSON.stringify({ ...valid, point: { latitude: 999, longitude: 0 } }),
  ])
    assert.equal(readMessage(value), null);
  assert.deepEqual(readMessage('{"type":"ready"}'), { type: "ready" });
});

test("selected points survive starting and waiting for a demo companion", () => {
  const intent = {
    origin: "Ponto A",
    destination: "Ponto B",
    points: initialPoints,
    departure: Date.now() + 3600000,
    timeZone: "America/Sao_Paulo",
    passengers: 1,
    walkingLimit: 400,
    fixed: false,
  };
  const now = intent.departure - 3600000;
  let state = transition(
    initialState,
    { type: "start", intent, candidates: demoCandidates(intent) },
    now,
  );
  assert.deepEqual(state.intent.points, initialPoints);
  state = transition(
    state,
    { type: "request", id: "evandro", expectedRevision: state.revision },
    now,
  );
  assert.equal(state.pending, "evandro");
  assert.deepEqual(state.intent.points, initialPoints);
});

test("map update protocol defaults to read-only", () => {
  const value = JSON.parse(mapUpdate({ points: initialPoints }));
  assert.equal(value.editable, false);
  assert.equal(value.selected, "origin");
  assert.deepEqual(value.points, initialPoints);
});

test("bundled Leaflet and map runtime scripts parse without remote JS", async () => {
  const assets = JSON.parse(
    await readFile(
      new URL("../src/features/maps/generated/leaflet.json", import.meta.url),
      "utf8",
    ),
  );
  new Script(assets.js);
  const source = await readFile(
    new URL("../src/features/maps/html.ts", import.meta.url),
    "utf8",
  );
  const runtime = source.split("<script>\n")[1].split("</script>")[0];
  new Script(runtime);
  assert.match(source, /https:\/\/tile.openstreetmap.org\//);
  assert.doesNotMatch(source, /<script src=/);
});

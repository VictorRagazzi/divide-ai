import assert from "node:assert/strict";
import test from "node:test";
import {
  commonWindow,
  demoCandidates,
  eligible,
  initialState,
  makeProposal,
  parseSearch,
  transition,
  validProposal,
} from "../src/features/demo/domain.ts";

const departure = Date.parse("2026-10-11T18:00:00-03:00");
const now = departure - 60 * 60_000;
const intent = {
  departure,
  timeZone: "America/Sao_Paulo",
  fixed: false,
  passengers: 1,
  walkingLimit: 400,
  origin: "Centro",
  destination: "Campus",
};
const candidates = demoCandidates(intent);
const start = () =>
  transition(initialState, { type: "start", intent, candidates }, now);
const request = (state, id, at = now) =>
  transition(
    state,
    { type: "request", id, expectedRevision: state.revision },
    at,
  );

const match = (id = "evandro") =>
  transition(request(start(), id), { type: "simulate-match" }, now);
const confirm = (state, who, at = now, version = state.proposal.version) =>
  transition(
    state,
    {
      type: "confirm-proposal",
      who,
      negotiation: state.proposal.negotiation,
      expectedVersion: version,
    },
    at,
  );

test("both confirmations refer to same version; editing invalidates the agreement", () => {
  const matched = match();
  const first = confirm(matched, "theirs");
  assert.equal(first.proposal.mine, false);
  const agreed = confirm(first, "mine");
  assert.equal(agreed.proposal.mine && agreed.proposal.theirs, true);
  const edited = transition(
    agreed,
    {
      type: "choose-proposal",
      choice: "theirs",
      negotiation: agreed.proposal.negotiation,
      expectedVersion: agreed.proposal.version,
    },
    now,
  );
  assert.equal(edited.proposal.version, 2);
  assert.equal(edited.proposal.mine || edited.proposal.theirs, false);
  assert.equal(confirm(edited, "mine", now, 1).proposal.mine, false);
  assert.equal(edited.matched, "evandro");
});

test("confirmed and unconfirmed negotiations survive discovery deadline", () => {
  const matched = match();
  const afterDeadline = transition(
    matched,
    { type: "tick" },
    departure + 60_000,
  );
  assert.equal(afterDeadline.matched, "evandro");
  const agreed = confirm(
    confirm(afterDeadline, "theirs", departure + 60_000),
    "mine",
    departure + 60_000,
  );
  assert.equal(agreed.proposal.mine && agreed.proposal.theirs, true);
  assert.equal(
    transition(agreed, { type: "tick" }, departure + 120_000).matched,
    "evandro",
  );
});

test("new search cannot replace an exclusive negotiation", () => {
  const matched = match();
  assert.equal(
    transition(matched, { type: "start", intent, candidates }, now),
    matched,
  );
});

test("cancel invalidates messages and confirmations; old commands cannot affect new match", () => {
  const matched = match();
  const old = {
    type: "confirm-proposal",
    who: "mine",
    negotiation: matched.proposal.negotiation,
    expectedVersion: 1,
  };
  const cancelled = transition(
    matched,
    { type: "cancel-negotiation", negotiation: matched.proposal.negotiation },
    departure + 60_000,
  );
  assert.equal(cancelled.matched, null);
  assert.equal(cancelled.proposal, null);
  assert.deepEqual(cancelled.messages, []);
  assert.equal(
    transition(
      cancelled,
      {
        type: "chat",
        text: "late",
        sender: "mine",
        negotiation: old.negotiation,
      },
      now,
    ),
    cancelled,
  );
  const restarted = transition(
    cancelled,
    { type: "start", intent, candidates },
    now,
  );
  const next = transition(
    request(restarted, "evandro"),
    { type: "simulate-match" },
    now,
  );
  assert.notEqual(next.proposal.negotiation, old.negotiation);
  assert.equal(transition(next, old, now).proposal.mine, false);
});

test("chat only opens after mutual acceptance and never confirms a proposal", () => {
  const pending = request(start(), "evandro");
  assert.equal(
    transition(
      pending,
      { type: "chat", text: "Hello", sender: "mine", negotiation: 0 },
      now,
    ),
    pending,
  );
  const matched = match();
  const sent = transition(
    matched,
    {
      type: "chat",
      text: "  Vamos!  ",
      sender: "mine",
      negotiation: matched.proposal.negotiation,
    },
    now,
  );
  assert.equal(sent.messages.at(-1).text, "Vamos!");
  assert.equal(sent.proposal.mine || sent.proposal.theirs, false);
  assert.equal(
    transition(
      sent,
      {
        type: "chat",
        text: " ",
        sender: "mine",
        negotiation: sent.proposal.negotiation,
      },
      now,
    ),
    sent,
  );
});

test("route shortcuts respect fixed shared departure and all four walking limits", () => {
  const bruno = candidates[1];
  const suggestion = makeProposal(intent, bruno, "suggestion", 1, 1);
  const mine = makeProposal(intent, bruno, "mine", 1, 1);
  assert.notEqual(suggestion.pickup, mine.pickup);
  assert.notEqual(suggestion.dropoff, mine.dropoff);
  for (const choice of ["suggestion", "mine", "theirs", "stop"]) {
    const proposal = makeProposal(intent, bruno, choice, 1, 1);
    assert.equal(proposal.departure, bruno.departure);
    assert.equal(validProposal(proposal, intent, bruno), true);
    for (let i = 0; i < 4; i++) {
      const walks = [...proposal.walks];
      walks[i] = 401;
      assert.equal(validProposal({ ...proposal, walks }, intent, bruno), false);
      walks[i] = Number.NaN;
      assert.equal(validProposal({ ...proposal, walks }, intent, bruno), false);
    }
    assert.equal(
      validProposal(
        { ...proposal, departure: intent.departure },
        intent,
        bruno,
      ),
      false,
    );
  }
  assert.equal(makeProposal(intent, bruno, "stop", 1, 1).stops.length, 1);
});

test("invalid route command preserves proposal and confirmations", () => {
  const matched = match();
  const limited = { ...matched, intent: { ...intent, walkingLimit: 350 } };
  const edited = transition(
    limited,
    {
      type: "choose-proposal",
      choice: "theirs",
      negotiation: limited.proposal.negotiation,
      expectedVersion: 1,
    },
    now,
  );
  assert.equal(edited.proposal, limited.proposal);
  const invalid = {
    ...matched,
    proposal: { ...matched.proposal, walks: [401, 0, 0, 0] },
  };
  assert.equal(confirm(invalid, "mine").proposal.mine, false);
});

test("inclusive windows meet at one instant, fixed hours remain exact", () => {
  assert.deepEqual(
    commonWindow(intent, { departure: departure + 30 * 60_000, fixed: false }),
    { start: departure + 15 * 60_000, end: departure + 15 * 60_000 },
  );
  assert.equal(
    commonWindow(
      { ...intent, fixed: true },
      { departure: departure + 1, fixed: true },
    ),
    null,
  );
  assert.ok(
    commonWindow(
      { ...intent, fixed: true },
      { departure: departure + 15 * 60_000, fixed: false },
    ),
  );
});

test("availability spans midnight using instants", () => {
  const midnight = Date.parse("2026-10-12T00:00:00-03:00");
  assert.deepEqual(
    commonWindow(
      { departure: midnight - 15 * 60_000, fixed: false },
      { departure: midnight + 15 * 60_000, fixed: false },
    ),
    { start: midnight, end: midnight },
  );
});

test("capacity and each walking endpoint for both participants are checked", () => {
  assert.equal(
    eligible({ ...intent, passengers: 2 }, candidates[2], now),
    false,
  );
  assert.equal(
    eligible({ ...intent, passengers: 2 }, candidates[0], now),
    true,
  );
  for (const key of [
    "pickup",
    "dropoff",
    "companionPickup",
    "companionDropoff",
  ]) {
    assert.equal(
      eligible(intent, { ...candidates[0], [key]: 401 }, now),
      false,
      key,
    );
  }
  assert.equal(
    eligible(intent, { ...candidates[0], pickup: 400, dropoff: 400 }, now),
    true,
  );
});

test("exploring and skipping preserve pending request; review clears only skips", () => {
  const pending = request(start(), "evandro");
  const skipped = transition(pending, { type: "skip", id: "bruno" }, now);
  assert.equal(skipped.pending, "evandro");
  assert.equal(skipped.revision, pending.revision);
  const reviewed = transition(skipped, { type: "review" }, now);
  assert.deepEqual(reviewed.skipped, []);
  assert.equal(reviewed.pending, "evandro");
});

test("successful replacement names both people and leaves one pending", () => {
  const replaced = request(request(start(), "evandro"), "bruno");
  assert.equal(replaced.pending, "bruno");
  assert.match(replaced.message, /Evandro.*Bruno/);
  assert.equal(replaced.matched, null);
});

test("unavailable or expired replacement target preserves previous valid request", () => {
  const pending = request(start(), "evandro");
  const unavailable = transition(
    pending,
    { type: "unavailable", id: "bruno" },
    now,
  );
  assert.equal(request(unavailable, "bruno").pending, "evandro");
  const targetExpired = {
    ...pending,
    candidates: pending.candidates.map((c) =>
      c.id === "bruno" ? { ...c, departure: now } : c,
    ),
  };
  assert.equal(request(targetExpired, "bruno").pending, "evandro");
});

test("stale modal cannot undo mutual acceptance or replace a changed request", () => {
  const pending = request(start(), "evandro");
  const command = {
    type: "request",
    id: "bruno",
    expectedRevision: pending.revision,
  };
  const matched = transition(pending, { type: "simulate-match" }, now);
  const result = transition(matched, command, now);
  assert.equal(result.matched, "evandro");
  assert.equal(result.pending, null);
  assert.equal(
    transition(request(pending, "bruno"), command, now).pending,
    "bruno",
  );
});

test("reset keeps revisions unique across sessions and rejects an old modal", () => {
  const pending = request(start(), "evandro");
  const stale = {
    type: "request",
    id: "bruno",
    expectedRevision: pending.revision,
  };
  const reset = transition(pending, { type: "reset" }, now);
  const restarted = transition(
    reset,
    { type: "start", intent, candidates },
    now,
  );
  const next = request(restarted, "evandro");
  assert.notEqual(next.revision, pending.revision);
  assert.equal(transition(next, stale, now).pending, "evandro");
});

test("unavailable pending companion cannot be matched", () => {
  const pending = request(start(), "evandro");
  const removed = transition(
    pending,
    { type: "unavailable", id: "evandro" },
    now,
  );
  assert.equal(removed.pending, null);
  assert.equal(
    transition(removed, { type: "simulate-match" }, now).matched,
    null,
  );
});

test("expiration at original instant rejects request, despite flexible window", () => {
  const pending = request(start(), "evandro");
  const expired = transition(pending, { type: "tick" }, departure);
  assert.equal(expired.pending, null);
  assert.equal(request(expired, "bruno", departure).pending, null);
  assert.equal(
    transition(pending, { type: "simulate-match" }, departure).matched,
    null,
  );
});

test("request expires at earlier companion departure; mutual acceptance survives search expiry", () => {
  const early = {
    ...start(),
    candidates: [{ ...candidates[0], departure: departure - 10 * 60_000 }],
  };
  assert.equal(
    transition(
      request(early, "evandro"),
      { type: "tick" },
      departure - 10 * 60_000,
    ).pending,
    null,
  );
  const matched = transition(
    request(start(), "evandro"),
    { type: "simulate-match" },
    now,
  );
  assert.equal(
    transition(matched, { type: "tick" }, departure).matched,
    "evandro",
  );
});

test("input validation rejects invalid calendar dates, times, past and passenger count", () => {
  const localNow = new Date(2026, 9, 11, 17, 0).getTime();
  const fields = {
    origin: "Centro",
    destination: "Campus",
    date: "2026-10-11",
    time: "18:00",
    passengers: "1",
    walkingLimit: "400",
    fixed: false,
  };
  assert.equal(Object.keys(parseSearch(fields, localNow).errors).length, 0);
  assert.ok(parseSearch({ ...fields, date: "2026-02-30" }, now).errors.date);
  assert.ok(parseSearch({ ...fields, time: "24:00" }, now).errors.time);
  assert.ok(parseSearch(fields, departure + 24 * 60 * 60_000).errors.time);
  assert.ok(parseSearch({ ...fields, passengers: "3" }, now).errors.passengers);
  assert.ok(
    parseSearch({ ...fields, walkingLimit: "" }, now).errors.walkingLimit,
  );
  assert.ok(
    parseSearch({ ...fields, destination: "Centro" }, now).errors.destination,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  commonWindow,
  DEMO_OTP,
  demoCandidates,
  eligible,
  emailError,
  initialState,
  isAgreed,
  makeProposal,
  otpError,
  otpStatus,
  ownRating,
  parseProfile,
  parseSearch,
  receivedState,
  reportError,
  reviewError,
  stageHref,
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
const pick = (
  state,
  who,
  choice,
  { at = now, version = state.proposal.version, stop } = {},
) =>
  transition(
    state,
    {
      type: "pick",
      who,
      choice,
      stop,
      negotiation: state.proposal.negotiation,
      expectedVersion: version,
    },
    at,
  );

test("agreement is derived from both sides picking the same content; changing it undoes the agreement", () => {
  const matched = match();
  assert.equal(isAgreed(matched.proposal), false);
  const first = pick(matched, "theirs", "suggestion");
  assert.equal(isAgreed(first.proposal), false);
  assert.equal(first.proposal.picks.mine, null);
  const agreed = pick(first, "mine", "suggestion");
  assert.equal(isAgreed(agreed.proposal), true);
  const edited = pick(agreed, "mine", "theirs");
  assert.equal(edited.proposal.version, agreed.proposal.version + 1);
  assert.equal(isAgreed(edited.proposal), false);
  assert.equal(edited.proposal.picks.theirs.choice, "suggestion");
  assert.equal(
    pick(edited, "mine", "suggestion", { version: agreed.proposal.version })
      .proposal.picks.mine.choice,
    "theirs",
  );
  assert.equal(edited.matched, "evandro");
});

test("different picks never agree; stops agree only at the same place", () => {
  const matched = match();
  const stops = ["Local A", "Local B"];
  const split = pick(pick(matched, "mine", "mine"), "theirs", "theirs");
  assert.equal(isAgreed(split.proposal), false);
  assert.match(split.message, /diferentes/);
  const a = pick(matched, "mine", "stop", { stop: stops[0] });
  const b = pick(a, "theirs", "stop", { stop: stops[1] });
  assert.equal(isAgreed(b.proposal), false);
  assert.deepEqual(a.proposal.stops, [stops[0]]);
  const c = pick(b, "theirs", "stop", { stop: stops[0] });
  assert.equal(isAgreed(c.proposal), true);
  assert.match(c.message, /mesma opção/);
});

test("picks survive discovery deadline", () => {
  const matched = match();
  const afterDeadline = transition(
    matched,
    { type: "tick" },
    departure + 60_000,
  );
  assert.equal(afterDeadline.matched, "evandro");
  const at = departure + 60_000;
  const agreed = pick(
    pick(afterDeadline, "theirs", "suggestion", { at }),
    "mine",
    "suggestion",
    { at },
  );
  assert.equal(isAgreed(agreed.proposal), true);
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
    type: "pick",
    who: "mine",
    choice: "suggestion",
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
  assert.equal(transition(next, old, now).proposal.picks.mine, null);
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
  assert.equal(sent.proposal.picks.mine || sent.proposal.picks.theirs, null);
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

test("invalid route command preserves proposal and picks", () => {
  const matched = pick(match(), "theirs", "suggestion");
  const limited = { ...matched, intent: { ...intent, walkingLimit: 350 } };
  const edited = pick(limited, "mine", "theirs");
  assert.equal(edited.proposal, limited.proposal);
  assert.match(edited.message, /limite de caminhada/);
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

// ---- Depois da viagem: lembrete, avaliação, não realizada, segurança ----

const agreedTrip = () => {
  const matched = match();
  return pick(pick(matched, "theirs", "suggestion"), "mine", "suggestion");
};
const ended = () => {
  const agreed = agreedTrip();
  return transition(
    agreed,
    { type: "end-trip", negotiation: agreed.proposal.negotiation },
    now,
  );
};
const send = (state, command) =>
  transition(
    state,
    { negotiation: state.postTrip?.negotiation, ...command },
    now,
  );

test("a trip only ends after both picked the same option", () => {
  const matched = match();
  const early = transition(
    matched,
    { type: "end-trip", negotiation: matched.proposal.negotiation },
    now,
  );
  assert.equal(early.postTrip, null);
  assert.equal(
    transition(agreedTrip(), { type: "end-trip", negotiation: 999 }, now)
      .postTrip,
    null,
  );
  const done = ended();
  assert.equal(done.postTrip.happened, null);
  assert.equal(stageHref(done), "/lembrete");
  assert.equal(send(done, { type: "end-trip" }), done);
});

test("after the trip ends, picks, chat and cancel no longer change the agreement", () => {
  const done = ended();
  assert.equal(pick(done, "mine", "mine"), done);
  assert.equal(
    transition(
      done,
      {
        type: "chat",
        text: "oi",
        sender: "mine",
        negotiation: done.proposal.negotiation,
      },
      now,
    ),
    done,
  );
  assert.equal(
    transition(
      done,
      { type: "cancel-negotiation", negotiation: done.proposal.negotiation },
      now,
    ),
    done,
  );
});

test("reviews need 1-5 stars and a text below 3 stars", () => {
  assert.ok(reviewError(0, "x"));
  assert.ok(reviewError(6, "x"));
  assert.ok(reviewError(2.5, "x"));
  assert.ok(reviewError(2, "   "));
  assert.equal(reviewError(2, "Atrasou muito"), null);
  assert.equal(reviewError(3, ""), null);
  assert.ok(reviewError(5, "a".repeat(501)));
  const happened = send(ended(), { type: "trip-happened", happened: true });
  assert.equal(stageHref(happened), "/avaliar");
  const refused = send(happened, { type: "rate", stars: 1, comment: " " });
  assert.equal(refused.postTrip.mine, null);
  assert.match(refused.message, /obrigatório/);
  const reviewed = send(happened, {
    type: "rate",
    stars: 2,
    comment: "  Atrasou  ",
  });
  assert.deepEqual(reviewed.postTrip.mine, { stars: 2, comment: "Atrasou" });
  assert.equal(stageHref(reviewed), "/avaliacao-enviada");
  assert.equal(
    send(reviewed, { type: "rate", stars: 5, comment: "" }),
    reviewed,
  );
});

test("a review needs the trip to have happened", () => {
  const asked = ended();
  assert.equal(send(asked, { type: "rate", stars: 5, comment: "" }), asked);
  const no = send(asked, {
    type: "trip-happened",
    happened: false,
    reason: "no-show",
  });
  assert.equal(send(no, { type: "rate", stars: 5, comment: "" }), no);
  assert.equal(
    send(asked, { type: "trip-happened", happened: false }),
    asked,
    "a not-happened report needs a known reason",
  );
  assert.equal(stageHref(no), "/nao-realizada");
  assert.equal(
    send(no, { type: "trip-happened", happened: true }),
    no,
    "the answer cannot be changed",
  );
});

test("received review stays locked until the person also reviews", () => {
  const happened = send(ended(), { type: "trip-happened", happened: true });
  assert.equal(receivedState(happened.postTrip), "none");
  const theirs = send(happened, { type: "simulate-their-review" });
  assert.equal(receivedState(theirs.postTrip), "locked");
  const reviewed = send(theirs, { type: "rate", stars: 5, comment: "" });
  assert.equal(receivedState(reviewed.postTrip), "visible");
  const waiting = send(happened, { type: "rate", stars: 5, comment: "" });
  assert.equal(receivedState(waiting.postTrip), "waiting");
  assert.equal(
    receivedState(send(waiting, { type: "simulate-their-review" }).postTrip),
    "visible",
  );
});

test("closing the trip archives it, frees the search and rates the user only from released reviews", () => {
  const happened = send(ended(), { type: "trip-happened", happened: true });
  assert.equal(
    send(ended(), { type: "close-trip" }).postTrip.happened,
    null,
    "cannot close before answering",
  );
  const rated = send(send(happened, { type: "rate", stars: 5, comment: "" }), {
    type: "simulate-their-review",
  });
  const closed = send(rated, { type: "close-trip" });
  assert.equal(closed.matched, null);
  assert.equal(closed.proposal, null);
  assert.equal(closed.postTrip, null);
  assert.equal(closed.history.length, 1);
  assert.equal(closed.history[0].name, "Evandro");
  assert.equal(closed.history[0].happened, true);
  assert.deepEqual(ownRating(closed.history), { average: 4, count: 1 });
  const again = transition(closed, { type: "start", intent, candidates }, now);
  assert.equal(again.history.length, 1);
  assert.ok(again.intent);
  const unreleased = send(
    send(happened, { type: "rate", stars: 5, comment: "" }),
    { type: "close-trip" },
  );
  assert.equal(ownRating(unreleased.history), null, "no invented rating");
  const notHappened = send(
    send(ended(), {
      type: "trip-happened",
      happened: false,
      reason: "agreed-cancel",
    }),
    { type: "close-trip" },
  );
  assert.equal(notHappened.history[0].happened, false);
  assert.equal(notHappened.history[0].reason, "agreed-cancel");
  assert.equal(ownRating(notHappened.history), null);
});

test("reports and blocks work without a review and are independent", () => {
  assert.ok(reportError(null, "x"));
  assert.ok(reportError("other", "  "));
  assert.equal(reportError("unsafe", ""), null);
  const asked = ended();
  const reported = transition(
    asked,
    { type: "report", companion: "evandro", reason: "unsafe", details: " x " },
    now,
  );
  assert.equal(reported.reports.length, 1);
  assert.equal(reported.reports[0].details, "x");
  assert.deepEqual(reported.blocked, []);
  assert.equal(
    transition(
      asked,
      { type: "report", companion: "evandro", reason: "other", details: "" },
      now,
    ),
    asked,
  );
  const blocked = transition(
    asked,
    { type: "block", companion: "evandro" },
    now,
  );
  assert.deepEqual(blocked.blocked, ["evandro"]);
  assert.equal(blocked.reports.length, 0);
  assert.ok(blocked.postTrip, "blocking after the trip keeps the review flow");
  const closed = send(
    send(blocked, { type: "trip-happened", happened: true }),
    {
      type: "close-trip",
    },
  );
  assert.equal(closed.history.length, 1);
  assert.deepEqual(closed.blocked, ["evandro"]);
});

test("blocking a companion ends an open negotiation and hides them from new searches", () => {
  const blocked = transition(
    match(),
    { type: "block", companion: "evandro" },
    now,
  );
  assert.equal(blocked.matched, null);
  assert.equal(blocked.proposal, null);
  assert.deepEqual(blocked.blocked, ["evandro"]);
  const again = transition(blocked, { type: "start", intent, candidates }, now);
  assert.ok(!again.candidates.some((c) => c.id === "evandro"));
  assert.equal(again.candidates.length, candidates.length - 1);
  const dropped = transition(
    request(start(), "bruno"),
    { type: "block", companion: "bruno" },
    now,
  );
  assert.equal(dropped.pending, null);
  assert.ok(!dropped.candidates.some((c) => c.id === "bruno"));
  const unblocked = transition(
    blocked,
    { type: "unblock", companion: "evandro" },
    now,
  );
  assert.deepEqual(unblocked.blocked, []);
  assert.deepEqual(
    transition(blocked, { type: "reset" }, now).blocked,
    [],
    "reset starts the demo clean",
  );
});

test("blocks and history survive cancelling a negotiation", () => {
  const matched = match("evandro");
  const blockedBefore = transition(
    matched,
    { type: "block", companion: "camila" },
    now,
  );
  const cancelled = transition(
    blockedBefore,
    { type: "cancel-negotiation", negotiation: matched.proposal.negotiation },
    now,
  );
  assert.equal(cancelled.matched, null);
  assert.deepEqual(cancelled.blocked, ["camila"]);
});

test("email, code and profile validation", () => {
  assert.ok(emailError(""));
  assert.ok(emailError("sem-arroba"));
  assert.ok(emailError("a@b"));
  assert.equal(emailError(" ana@exemplo.com "), null);
  const signedIn = transition(
    initialState,
    { type: "verify-email", email: " Ana@Exemplo.com " },
    now,
  );
  assert.equal(signedIn.session, "ana@exemplo.com");
  assert.equal(
    transition(initialState, { type: "verify-email", email: "x" }, now),
    initialState,
  );
  const sent = now;
  assert.deepEqual(otpStatus(sent, sent), { expired: false, resendIn: 60 });
  assert.equal(otpStatus(sent, sent + 59_001).resendIn, 1);
  assert.equal(otpStatus(sent, sent + 60_000).resendIn, 0);
  assert.equal(otpStatus(sent, sent + 10 * 60_000 - 1).expired, false);
  assert.equal(otpStatus(sent, sent + 10 * 60_000).expired, true);
  assert.equal(otpError(DEMO_OTP, sent, sent + 1000), null);
  assert.equal(otpError("123 456", sent, sent + 1000), null);
  assert.match(otpError("000000", sent, sent + 1000), /incorreto/);
  assert.match(otpError(DEMO_OTP, sent, sent + 10 * 60_000), /expirou/);

  const fields = {
    email: "ana@exemplo.com",
    name: "  Ana   Souza ",
    phone: "(31) 99999-0000",
    day: "5",
    month: "3",
    year: "1998",
    photo: false,
  };
  const ok = parseProfile(fields, now);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.profile.name, "Ana Souza");
  assert.equal(ok.profile.phone, "31999990000");
  assert.equal(ok.profile.birth, "1998-03-05");
  assert.equal(parseProfile({ ...fields, phone: "" }, now).profile.phone, "");
  assert.ok(parseProfile({ ...fields, phone: "123" }, now).errors.phone);
  assert.ok(parseProfile({ ...fields, name: "A" }, now).errors.name);
  assert.ok(
    parseProfile({ ...fields, day: "31", month: "2" }, now).errors.birth,
  );
  assert.ok(parseProfile({ ...fields, year: "98" }, now).errors.birth);
  assert.ok(parseProfile({ ...fields, year: "2999" }, now).errors.birth);
  const profile = ok.profile;
  assert.equal(
    transition(
      signedIn,
      {
        type: "save-profile",
        profile: { ...profile, email: "outra@exemplo.com" },
      },
      now,
    ).profile,
    null,
    "profile needs the verified e-mail",
  );
  const saved = transition(
    transition(
      initialState,
      { type: "verify-email", email: profile.email },
      now,
    ),
    { type: "save-profile", profile },
    now,
  );
  assert.equal(saved.profile.name, "Ana Souza");
  assert.equal(
    transition(saved, { type: "reset" }, now).profile.name,
    "Ana Souza",
  );
  assert.equal(transition(saved, { type: "sign-out" }, now).session, null);
});

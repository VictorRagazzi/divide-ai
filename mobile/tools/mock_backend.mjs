// Backend FALSO para desenvolver e testar a integração sem servidor de verdade.
// Implementa o contrato de documentos/Integracao_backend.md (rotas, corpos,
// instantes ISO, Idempotency-Key, 401/409) com a MESMA regra do app demo
// (domain.ts) rodando por trás de HTTP. Estado só em memória; nada é enviado
// para fora da máquina e nenhum e-mail é disparado. NÃO é o backend real.
//
//   node --experimental-strip-types tools/mock_backend.mjs        (porta 8787)
//   PORT=9000 MOCK_MATCH_MS=2000 MOCK_TRIP_MS=15000 node ...
//
// Aponte o app para ele no .env (ver mobile/.env.mock.example) e exporte de novo.
import http from "node:http";
import { randomUUID } from "node:crypto";
import {
  DEMO_OTP,
  demoCandidates,
  initialState,
  isAgreed,
  transition,
} from "../src/features/demo/domain.ts";

const PORT = Number(process.env.PORT ?? 8787);
const MATCH_MS = Number(process.env.MOCK_MATCH_MS ?? 3000);
const TRIP_MS = Number(process.env.MOCK_TRIP_MS ?? 15000);
const REVIEW_MS = 3000;

const users = new Map(); // email -> { state, marks, replies }
const tokens = new Map(); // access token -> email
const refresh = new Map(); // refresh token -> email

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};
const send = (res, status, body) => {
  res.writeHead(status, { ...cors, "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });

// ---- estado -> formato do fio (instantes em ISO-8601 UTC) -------------------
const iso = (ms) => new Date(ms).toISOString();
function wire(state) {
  const { session: _session, ...rest } = state;
  const out = { ...rest };
  if (state.intent)
    out.intent = { ...state.intent, departure: iso(state.intent.departure) };
  out.candidates = state.candidates.map((c) => ({ ...c, departure: iso(c.departure) }));
  if (state.proposal)
    out.proposal = { ...state.proposal, departure: iso(state.proposal.departure) };
  out.messages = state.messages.map((m) => ({ ...m, at: iso(m.at) }));
  if (state.postTrip)
    out.postTrip = { ...state.postTrip, endedAt: iso(state.postTrip.endedAt) };
  out.history = state.history.map((t) => ({ ...t, endedAt: iso(t.endedAt) }));
  out.reports = state.reports.map((r) => ({ ...r, at: iso(r.at) }));
  return out;
}

// ---- relógio do "servidor": o que a outra pessoa e o tempo fariam ---------
function advance(user, now) {
  const { marks } = user;
  let s = transition(user.state, { type: "tick" }, now);
  if (s.pending && !s.matched) {
    marks.pending ??= now;
    if (now - marks.pending >= MATCH_MS)
      s = transition(s, { type: "simulate-match" }, now);
  } else marks.pending = null;
  if (s.proposal && isAgreed(s.proposal) && !s.postTrip) {
    marks.agreed ??= now;
    if (now - marks.agreed >= TRIP_MS)
      s = transition(s, { type: "end-trip", negotiation: s.proposal.negotiation }, now);
  } else if (!s.proposal) marks.agreed = null;
  const post = s.postTrip;
  if (post?.happened === true && post.mine && !post.theirs) {
    marks.rated ??= now;
    if (now - marks.rated >= REVIEW_MS)
      s = transition(s, { type: "simulate-their-review", negotiation: post.negotiation }, now);
  } else if (!post) marks.rated = null;
  user.state = s;
  return s;
}

// ---- rotas -> comandos do domínio -----------------------------------------
const ms = (value) => Date.parse(value);
const routes = {
  "POST /api/profile": (b) => ({ type: "save-profile", profile: b.profile }),
  "POST /api/intent": (b) => {
    const intent = { ...b.intent, departure: ms(b.intent?.departure) };
    return { type: "start", intent, candidates: demoCandidates(intent) };
  },
  "POST /api/intent/cancel": () => ({ type: "cancel-search" }),
  "POST /api/request": (b) => ({ type: "request", id: b.candidateId, expectedRevision: b.expectedRevision }),
  "POST /api/request/cancel": () => ({ type: "cancel" }),
  "POST /api/proposal/pick": (b) => ({
    type: "pick", who: "mine", choice: b.choice, stop: b.stop,
    negotiation: b.negotiation, expectedVersion: b.expectedVersion,
  }),
  "POST /api/messages": (b) => ({ type: "chat", sender: "mine", text: b.text, negotiation: b.negotiation }),
  "POST /api/negotiation/end": (b) => ({ type: "cancel-negotiation", negotiation: b.negotiation }),
  "POST /api/trip/outcome": (b) => ({ type: "trip-happened", negotiation: b.negotiation, happened: b.happened, reason: b.reason }),
  "POST /api/review": (b) => ({ type: "rate", negotiation: b.negotiation, stars: b.stars, comment: b.comment }),
  "POST /api/trip/close": (b) => ({ type: "close-trip", negotiation: b.negotiation }),
  "POST /api/report": (b) => ({ type: "report", companion: b.companionId, reason: b.reason, details: b.details }),
  "POST /api/block": (b) => ({ type: "block", companion: b.companionId }),
  "POST /api/block/remove": (b) => ({ type: "unblock", companion: b.companionId }),
};

function apply(user, command, now) {
  const before = advance(user, now);
  // Conflito (contrato 409): o aparelho decidiu com uma versão velha.
  if (command.type === "pick" && before.proposal && command.expectedVersion !== before.proposal.version)
    return { conflict: true };
  if (command.type === "request" && command.expectedRevision !== before.revision && before.pending)
    return { conflict: true };
  let s = transition(before, command, now);
  // A outra pessoa escolhe a mesma opção que você (para a demo chegar ao acordo).
  if (command.type === "pick" && s.proposal && s.proposal.picks.mine) {
    const mine = s.proposal.picks.mine;
    s = transition(
      s,
      { type: "pick", who: "theirs", choice: mine.choice, stop: mine.stop, negotiation: s.proposal.negotiation, expectedVersion: s.proposal.version },
      now,
    );
  }
  user.state = s;
  return { conflict: false };
}

const placeFor = (lat, lon) => ({
  id: `mock:${lat}:${lon}`,
  title: "Rua da Bahia, 1200",
  detail: "Centro · Belo Horizonte",
  street: "Rua da Bahia, 1200",
  area: "Centro · Belo Horizonte",
  latitude: lat,
  longitude: lon,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const key = `${req.method} ${url.pathname}`;
  if (req.method === "OPTIONS") return send(res, 204);
  if (!req.headers.apikey) return send(res, 401, { message: "apikey ausente" });
  const body = req.method === "GET" ? {} : await readBody(req);
  if (body === null) return send(res, 400, { message: "JSON inválido" });
  const now = Date.now();

  // ---- Supabase Auth (GoTrue) falso ----
  if (key === "POST /auth/v1/otp") {
    console.log(`[mock] código para ${body.email}: ${DEMO_OTP} (nenhum e-mail enviado)`);
    return send(res, 200, {});
  }
  if (key === "POST /auth/v1/verify") {
    if (body.token !== DEMO_OTP) return send(res, 403, { error_code: "otp_expired" });
    const email = String(body.email).toLowerCase();
    const access = `at-${randomUUID()}`;
    const refreshToken = `rt-${randomUUID()}`;
    tokens.set(access, email);
    refresh.set(refreshToken, email);
    users.has(email) || users.set(email, { state: { ...initialState, session: email }, marks: {}, replies: new Map() });
    return send(res, 200, { access_token: access, refresh_token: refreshToken, expires_in: 3600, user: { email } });
  }
  if (key === "POST /auth/v1/token") {
    const email = refresh.get(body.refresh_token);
    if (!email) return send(res, 400, {});
    const access = `at-${randomUUID()}`;
    tokens.set(access, email);
    return send(res, 200, { access_token: access, refresh_token: body.refresh_token, expires_in: 3600, user: { email } });
  }
  if (key === "POST /auth/v1/logout") return send(res, 204);

  // ---- API de dados (exige sessão) ----
  const email = tokens.get(String(req.headers.authorization ?? "").replace(/^Bearer /, ""));
  const user = email && users.get(email);
  if (!user) return send(res, 401, { message: "sessão inválida" });

  if (key === "GET /api/places/search")
    return send(res, 200, { places: [placeFor(-19.932, -43.938), { ...placeFor(-19.925, -43.942), title: "Av. Afonso Pena, 1500", street: "Av. Afonso Pena, 1500" }] });
  if (key === "GET /api/places/reverse")
    return send(res, 200, { places: [placeFor(Number(url.searchParams.get("lat")), Number(url.searchParams.get("lon")))] });
  if (key === "GET /api/state") return send(res, 200, wire(advance(user, now)));
  if (key === "GET /api/candidates") return send(res, 200, { candidates: wire(advance(user, now)).candidates });
  if (key === "GET /api/messages") return send(res, 200, { messages: wire(advance(user, now)).messages });
  if (key === "GET /api/history") return send(res, 200, { history: wire(advance(user, now)).history });

  const build = routes[key];
  if (!build) return send(res, 404, { message: "rota desconhecida" });
  const replay = req.headers["idempotency-key"];
  if (replay && user.replies.has(replay)) return send(res, 200, user.replies.get(replay));
  const outcome = apply(user, build(body), now);
  if (outcome.conflict) return send(res, 409, wire(user.state));
  const reply = wire(user.state);
  if (replay) user.replies.set(replay, reply);
  console.log(`[mock] ${email} ${key} -> revision ${reply.revision}`);
  return send(res, 200, reply);
});

server.listen(PORT, "127.0.0.1", () =>
  console.log(`Backend falso em http://127.0.0.1:${PORT} (código de entrada ${DEMO_OTP}; combina em ${MATCH_MS} ms, viagem acaba em ${TRIP_MS} ms)`),
);

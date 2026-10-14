// O app valida CADA resposta do servidor com `readSnapshot` (gateway.ts) e rejeita
// a resposta inteira se algo estiver fora do formato. Aqui as respostas reais do
// SQL passam pelo MESMO validador do app, em cada etapa do fluxo.
// Executar com: PGLITE_DIR=... node --experimental-strip-types --test supabase/tests/contract.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { readSnapshot, toRequest } from "../../mobile/src/services/gateway.ts";
import { isAgreed } from "../../mobile/src/features/demo/domain.ts";
import { createDatabase, H, iso, loadPglite, match, twoWalkers } from "./harness.mjs";

const PGlite = await loadPglite();
const skip = PGlite ? false : "defina PGLITE_DIR (ver harness.mjs)";

test("todas as respostas do servidor passam pelo validador do app", { skip }, async () => {
  const api = await createDatabase(PGlite);
  const check = (label, raw) => {
    try {
      return readSnapshot(raw);
    } catch (error) {
      assert.fail(`${label}: ${error.message} (${error.detail ?? ""})`);
    }
  };
  check("estado vazio", await api.rpc("ana", "app_state"));
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const ana = await api.user("ana");

  const s0 = check("busca", await api.rpc("ana", "app_state"));
  assert.equal(s0.candidates.length, 1);
  check("lista de candidatos", await api.rpc("ana", "app_candidates", {}));
  const asked = check("pedido", await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s0.revision }));
  assert.equal(asked.pending, bruno);
  const sb = await api.rpc("bruno", "app_state");
  const m = check("aceite mútuo", await api.rpc("bruno", "app_request_send", { candidateId: ana, expectedRevision: sb.revision }));
  const negotiation = m.proposal.negotiation;
  check("chat", await api.rpc("ana", "app_message_send", { negotiation, text: "Oi" }));
  const a = check("escolha de Ana", await api.rpc("ana", "app_proposal_pick", { negotiation, expectedVersion: 1, choice: "suggestion" }));
  assert.equal(isAgreed(a.proposal), false);
  const b = check("escolha de Bruno", await api.rpc("bruno", "app_proposal_pick", { negotiation, expectedVersion: 2, choice: "suggestion" }));
  assert.equal(isAgreed(b.proposal), true, "o app deriva o acordo das duas escolhas");
  assert.equal(isAgreed(check("leitura de Ana", await api.rpc("ana", "app_state")).proposal), true);

  await api.sql("update negotiations set departure = departure - interval '5 hours'");
  await api.sql("update intents set departure = departure - interval '5 hours'");
  const post = check("pós-viagem", await api.rpc("ana", "app_state"));
  assert.equal(post.postTrip.happened, null);
  check("aconteceu", await api.rpc("ana", "app_trip_outcome", { negotiation, happened: true }));
  await api.rpc("bruno", "app_trip_outcome", { negotiation, happened: true });
  const locked = check("avaliação dele chegou antes", await api.rpc("bruno", "app_review_send", { negotiation, stars: 4, comment: "" }));
  assert.equal(locked.postTrip.mine.stars, 4);
  assert.equal(check("bloqueada", await api.rpc("ana", "app_state")).postTrip.theirs.stars, 0);
  check("avaliação", await api.rpc("ana", "app_review_send", { negotiation, stars: 5, comment: "ótimo" }));
  const closed = check("arquivada", await api.rpc("ana", "app_trip_close", { negotiation }));
  assert.equal(closed.history.length, 1);
  check("denúncia", await api.rpc("ana", "app_report_send", { companionId: bruno, reason: "unsafe", details: "x" }));
  check("bloqueio", await api.rpc("ana", "app_block_add", { companionId: bruno }));
  check("desbloqueio", await api.rpc("ana", "app_block_remove", { companionId: bruno }));
  check("histórico", await api.rpc("ana", "app_history", {}));
  void iso;
  void H;
  void match;
});

test("os corpos que o app envia têm as chaves que o SQL espera", { skip }, async () => {
  // Fixa a ligação entre gateway.ts (toRequest) e as funções app_*: se alguém
  // renomear uma chave de um lado, este teste quebra.
  const api = await createDatabase(PGlite);
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const expected = {
    START: { type: "start", intent: {
      departure: Date.now() + 3 * H, timeZone: "America/Sao_Paulo", fixed: false, passengers: 1,
      walkingLimit: 400, origin: "P", destination: "Q",
      points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
    }, candidates: [] },
  };
  const request = toRequest(expected.START);
  assert.equal(request.endpoint, "INTENT_SAVE");
  const res = await api.rpc("ana", "app_intent_save", request.body);
  assert.ok(res.intent);
  const rev = (await api.rpc("ana", "app_state")).revision;
  const req = toRequest({ type: "request", id: bruno, expectedRevision: rev });
  assert.equal(req.endpoint, "REQUEST_SEND");
  await api.rpc("ana", "app_request_send", req.body);
  const cancel = toRequest({ type: "cancel" });
  assert.equal((await api.rpc("ana", "app_request_cancel", cancel.body)).pending, null);
});

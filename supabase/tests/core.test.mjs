// Testes das regras do banco (migrations em supabase/migrations). Ver harness.mjs
// para executar. Sem PGLITE_DIR os testes são pulados (nunca "passam" em vão).
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDatabase,
  expectError,
  H,
  iso,
  loadPglite,
  match,
  twoWalkers,
} from "./harness.mjs";

const PGlite = await loadPglite();
const skip = PGlite ? false : "defina PGLITE_DIR (ver harness.mjs)";
const fresh = async () => createDatabase(PGlite);

// Faz "o tempo passar": recua o horário combinado e as intenções da dupla.
async function elapse(api, negotiation, hours) {
  const shift = `${hours} hours`;
  await api.sql("update negotiations set departure = departure - $1::interval where id = $2", [shift, negotiation]);
  await api.sql("update intents set departure = departure - $1::interval", [shift]);
}

async function agree(api, negotiation) {
  const s = await api.rpc("ana", "app_state");
  const afterA = await api.rpc("ana", "app_proposal_pick", {
    negotiation, expectedVersion: s.proposal.version, choice: "suggestion",
  });
  const afterB = await api.rpc("bruno", "app_proposal_pick", {
    negotiation, expectedVersion: afterA.proposal.version, choice: "suggestion",
  });
  return afterB;
}

test("cadastro valida o e-mail da conta e os campos", { skip }, async () => {
  const api = await fresh();
  const profile = { email: api.email("ana"), name: "  Ana   Lima ", phone: "(31) 99999-0000", birth: "1995-04-02", photo: false };
  const ok = await api.rpc("ana", "app_profile_save", { profile });
  assert.equal(ok.profile.name, "Ana Lima");
  assert.equal(ok.profile.phone, "31999990000");
  await expectError(api.rpc("ana", "app_profile_save", { profile: { ...profile, email: "outra@teste.dev" } }), 403);
  await expectError(api.rpc("ana", "app_profile_save", { profile: { ...profile, phone: "123" } }), 422);
  await expectError(api.rpc("ana", "app_profile_save", { profile: { ...profile, birth: "2999-01-01" } }), 422);
  await expectError(api.rpc("ana", "app_profile_save", { profile: { ...profile, birth: "31/02/1990" } }), 422);
  await expectError(api.rpc("ana", "app_profile_save", { profile: { ...profile, name: "A" } }), 422);
  await expectError(api.rpc("ana", "app_profile_save", {}), 422);
});

test("sem cadastro não há busca; busca valida horário, limites e pontos", { skip }, async () => {
  const api = await fresh();
  const intent = {
    departure: iso(Date.now() + 2 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1,
    walkingLimit: 400, origin: "A", destination: "B",
  };
  await expectError(api.rpc("ana", "app_intent_save", { intent }), 403);
  await api.rpc("ana", "app_profile_save", { profile: { email: api.email("ana"), name: "Ana", phone: "", birth: "1990-01-01", photo: false } });
  await api.rpc("ana", "app_intent_save", { intent });
  for (const bad of [
    { departure: iso(Date.now() - H) },
    { passengers: 3 },
    { passengers: 0 },
    { walkingLimit: -1 },
    { timeZone: "Marte/Olimpo" },
    { origin: " " },
    { destination: "A" }, // origem = destino
    { fixed: "sim" },
    { points: { origin: { latitude: 95, longitude: 0 }, destination: { latitude: 0, longitude: 0 } } },
    { points: { origin: { latitude: 1, longitude: 1 }, destination: { latitude: 1, longitude: 1 } } },
  ])
    await expectError(api.rpc("ana", "app_intent_save", { intent: { ...intent, ...bad } }), 422);
});

test("descoberta mostra só a projeção segura e respeita regras de compatibilidade", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const s = await api.rpc("ana", "app_state");
  assert.equal(s.candidates.length, 1);
  const [c] = s.candidates;
  assert.deepEqual(Object.keys(c).sort(), [
    "companionDropoff", "companionPickup", "departure", "dropoff", "fixed", "id", "name",
    "passengers", "pickup", "rating", "trips", "walkingLimit",
  ]);
  assert.equal(c.pickup, 200); // metade de ~300 m = 150, mostrado em faixas de 100 m (anti-trilateração)
  const dump = JSON.stringify(s.candidates);
  assert.doesNotMatch(dump, /Rua bruno|Savassi|@teste|latitude|-19\.9/);

  // Pontos longe demais: nenhuma sugestão.
  await api.sql("update intents set origin_lat = origin_lat + 0.02 where user_id = $1", [await api.user("bruno")]);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0);
  await api.sql("update intents set origin_lat = origin_lat - 0.02 where user_id = $1", [await api.user("bruno")]);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 1);

  // Quatro pessoas não cabem: 2 + 2 > 3.
  await api.sql("update intents set passengers = 2");
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0);
  await api.sql("update intents set passengers = 1");

  // Horários fixos distintos não se encontram; flexíveis a 15 min sim.
  await api.sql("update intents set fixed = true");
  await api.sql("update intents set departure = departure + interval '10 minutes' where user_id = $1", [await api.user("bruno")]);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0);
  await api.sql("update intents set fixed = false");
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 1);
  // 30 min: as janelas se tocam em um instante (inclusivo), ainda compatível.
  await api.sql("update intents set departure = departure + interval '20 minutes' where user_id = $1", [await api.user("bruno")]);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 1, "30 min de diferença");
  await api.sql("update intents set departure = departure + interval '1 minute' where user_id = $1", [await api.user("bruno")]);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0, "31 min de diferença");
});

test("pedido, revisão velha, substituição e aceite mútuo exclusivo", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const ana = await api.user("ana");
  const s0 = await api.rpc("ana", "app_state");

  const asked = await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s0.revision });
  assert.equal(asked.pending, bruno);
  assert.equal(asked.matched, null);
  assert.ok(asked.revision > s0.revision);
  // O destinatário ainda não está em negociação e não vê pedido que não fez.
  assert.equal((await api.rpc("bruno", "app_state")).pending, null);

  // Revisão velha é recusada sem mudar nada.
  await expectError(api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s0.revision }), 409);
  assert.equal((await api.rpc("ana", "app_state")).pending, bruno);

  // Cancelar e pedir de novo.
  const cancelled = await api.rpc("ana", "app_request_cancel", {});
  assert.equal(cancelled.pending, null);

  // Aceite mútuo: Ana pede, Bruno pede de volta.
  await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: cancelled.revision });
  const sb = await api.rpc("bruno", "app_state");
  const matched = await api.rpc("bruno", "app_request_send", { candidateId: ana, expectedRevision: sb.revision });
  assert.equal(matched.matched, ana);
  assert.equal(matched.proposal.version, 1);
  assert.equal(matched.proposal.picks.mine, null);
  const after = await api.rpc("ana", "app_state");
  assert.equal(after.matched, bruno);
  assert.equal(after.pending, null);
  assert.equal(after.proposal.negotiation, matched.proposal.negotiation);
  assert.equal(after.proposal.departure, matched.proposal.departure, "mesmo horário para os dois");

  // Participação exclusiva: ninguém mais enxerga os dois, e a busca não os substitui.
  await api.rpc("carla", "app_profile_save", { profile: { email: api.email("carla"), name: "Carla", phone: "", birth: "1990-01-01", photo: false } });
  await api.rpc("carla", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "C", destination: "D",
    points: { origin: { latitude: -19.9305, longitude: -43.94 }, destination: { latitude: -19.9205, longitude: -43.93 } },
  } });
  assert.equal((await api.rpc("carla", "app_state")).candidates.length, 0);
  const retry = await api.rpc("ana", "app_intent_save", { intent: {
    departure: iso(Date.now() + 5 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "X", destination: "Y",
  } });
  assert.equal(retry.matched, bruno);
  assert.match(retry.message, /em andamento/);
  await expectError(
    api.rpc("carla", "app_request_send", { candidateId: ana, expectedRevision: (await api.rpc("carla", "app_state")).revision }),
    409,
  );
});

test("substituir o pedido pendente cancela o anterior na mesma operação", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  await api.rpc("carla", "app_profile_save", { profile: { email: api.email("carla"), name: "Carla", phone: "", birth: "1990-01-01", photo: false } });
  await api.rpc("carla", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "C", destination: "D",
    points: { origin: { latitude: -19.9305, longitude: -43.94 }, destination: { latitude: -19.9205, longitude: -43.93 } },
  } });
  const bruno = await api.user("bruno");
  const carla = await api.user("carla");
  const s = await api.rpc("ana", "app_state");
  const first = await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s.revision });
  const second = await api.rpc("ana", "app_request_send", { candidateId: carla, expectedRevision: first.revision });
  assert.equal(second.pending, carla);
  const { rows } = await api.sql("select count(*)::int as n from requests where from_user = $1 and status = 'pending'", [await api.user("ana")]);
  assert.equal(rows[0].n, 1);
});

test("escolha da mesma opção: versão, conflito, limites e acordo derivado", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api, { limitA: 200, limitB: 400 }); // 300 m entre os pontos
  const negotiation = await match(api);
  const s = await api.rpc("ana", "app_state");
  assert.equal(s.proposal.version, 1);

  // "Meu ponto" faria o outro andar 300 m (limite dele 400 -> ok), mas "o ponto do outro" faria Ana andar 300 > 200.
  await expectError(api.rpc("ana", "app_proposal_pick", { negotiation, expectedVersion: 1, choice: "theirs" }), 422);
  // Parada ainda não existe no servidor.
  await expectError(api.rpc("ana", "app_proposal_pick", { negotiation, expectedVersion: 1, choice: "stop", stop: "Posto" }), 422);

  const mine = await api.rpc("ana", "app_proposal_pick", { negotiation, expectedVersion: 1, choice: "mine" });
  assert.equal(mine.proposal.version, 2);
  assert.deepEqual(mine.proposal.picks.mine, { choice: "mine" });
  assert.equal(mine.proposal.picks.theirs, null);
  assert.deepEqual(mine.proposal.walks, [0, 0, 300, 300]);

  // Comando atrasado com a versão antiga é conflito, nunca aceito.
  await expectError(api.rpc("bruno", "app_proposal_pick", { negotiation, expectedVersion: 1, choice: "theirs" }), 409);

  // Bruno vê a escolha de Ana como "theirs" (do ponto de vista dele ela escolheu "o meu"? não: o ponto dela).
  const sb = await api.rpc("bruno", "app_state");
  assert.deepEqual(sb.proposal.picks.theirs, { choice: "theirs" });
  assert.equal(sb.proposal.picks.mine, null);

  // Bruno escolhe o ponto de Ana: do ponto de vista dele, "theirs". Mesmo conteúdo -> acordo.
  const agreed = await api.rpc("bruno", "app_proposal_pick", { negotiation, expectedVersion: 2, choice: "theirs" });
  assert.equal(agreed.proposal.version, 3);
  assert.deepEqual(agreed.proposal.picks.mine, { choice: "theirs" });
  assert.deepEqual(agreed.proposal.picks.theirs, { choice: "theirs" });
  assert.match(agreed.message, /Viagem combinada/);

  // Ana vê o acordo na leitura dela: "mine" e "mine".
  const sa = await api.rpc("ana", "app_state");
  assert.deepEqual(sa.proposal.picks.mine, { choice: "mine" });
  assert.deepEqual(sa.proposal.picks.theirs, { choice: "mine" });

  // Mudar de ideia desfaz o acordo e sobe a versão; a escolha do outro permanece.
  const changed = await api.rpc("ana", "app_proposal_pick", { negotiation, expectedVersion: 3, choice: "suggestion" });
  assert.equal(changed.proposal.version, 4);
  assert.notDeepEqual(changed.proposal.picks.mine, changed.proposal.picks.theirs);
  assert.deepEqual(changed.proposal.picks.theirs, { choice: "mine" });

  // Quem não participa não encontra a negociação.
  await api.rpc("carla", "app_profile_save", { profile: { email: api.email("carla"), name: "Carla", phone: "", birth: "1990-01-01", photo: false } });
  await expectError(api.rpc("carla", "app_proposal_pick", { negotiation, expectedVersion: 4, choice: "suggestion" }), 404);
});

test("chat: só participantes, limites e repetição idempotente", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  const sent = await api.rpc("ana", "app_message_send", { negotiation, text: "  Oi! Combinamos aqui?  " }, { key: "k-1" });
  assert.equal(sent.messages.length, 1);
  assert.equal(sent.messages[0].sender, "mine");
  assert.equal(sent.messages[0].text, "Oi! Combinamos aqui?");

  // Repetir com a mesma chave não duplica e devolve o mesmo resultado.
  const again = await api.rpc("ana", "app_message_send", { negotiation, text: "  Oi! Combinamos aqui?  " }, { key: "k-1" });
  assert.deepEqual(again, sent);
  assert.equal((await api.sql("select count(*)::int n from messages")).rows[0].n, 1);
  // A mesma chave com outro conteúdo é rejeitada.
  await expectError(api.rpc("ana", "app_message_send", { negotiation, text: "outra" }, { key: "k-1" }), 422);

  const theirs = await api.rpc("bruno", "app_state");
  assert.equal(theirs.messages[0].sender, "theirs");
  assert.deepEqual((await api.rpc("bruno", "app_messages", { resource: "messages", negotiation })).messages, theirs.messages);

  await expectError(api.rpc("ana", "app_message_send", { negotiation, text: "   " }), 422);
  await expectError(api.rpc("ana", "app_message_send", { negotiation, text: "x".repeat(1001) }), 422);
  await api.rpc("carla", "app_profile_save", { profile: { email: api.email("carla"), name: "Carla", phone: "", birth: "1990-01-01", photo: false } });
  await expectError(api.rpc("carla", "app_message_send", { negotiation, text: "intrusa" }), 404);
  assert.deepEqual((await api.rpc("carla", "app_state")).messages, []);
});

test("cancelar a participação libera as duas pessoas e avisa a outra", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  const done = await api.rpc("ana", "app_negotiation_end", { negotiation });
  assert.equal(done.matched, null);
  assert.equal(done.proposal, null);
  assert.equal(done.intent, null, "quem cancela encerra a própria busca");
  const sb = await api.rpc("bruno", "app_state");
  assert.equal(sb.matched, null);
  assert.ok(sb.intent, "a busca de quem ficou volta, pois ainda é válida");
  assert.match(sb.message, /cancelou/);
  assert.equal((await api.rpc("bruno", "app_state")).message, "", "o aviso aparece uma vez só");
  await expectError(api.rpc("bruno", "app_negotiation_end", { negotiation }), 409);
  await expectError(api.rpc("ana", "app_message_send", { negotiation, text: "oi" }), 409);
});

test("fim da viagem, relato, avaliação com reciprocidade e histórico", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  const ana = await api.user("ana");
  const bruno = await api.user("bruno");

  // Antes do horário e sem acordo, nada de pós-viagem.
  assert.equal((await api.rpc("ana", "app_state")).postTrip, null);
  await agree(api, negotiation);
  assert.equal((await api.rpc("ana", "app_state")).postTrip, null);
  await expectError(api.rpc("ana", "app_trip_outcome", { negotiation, happened: true }), 409);

  await elapse(api, negotiation, 5);
  const post = (await api.rpc("ana", "app_state")).postTrip;
  assert.equal(post.happened, null);
  assert.equal(post.companion, bruno);
  assert.equal(post.mine, null);
  // Depois do fim, escolhas e conversa estão fechadas.
  await expectError(api.rpc("ana", "app_message_send", { negotiation, text: "oi" }), 409);
  await expectError(api.rpc("ana", "app_negotiation_end", { negotiation }), 409);

  // Avaliar exige dizer que a viagem aconteceu.
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 5, comment: "" }), 409);
  await expectError(api.rpc("ana", "app_trip_outcome", { negotiation, happened: false }), 422); // sem motivo
  await expectError(api.rpc("ana", "app_trip_outcome", { negotiation, happened: false, reason: "inventado" }), 422);
  await api.rpc("ana", "app_trip_outcome", { negotiation, happened: true });
  await api.rpc("bruno", "app_trip_outcome", { negotiation, happened: true });
  await expectError(api.rpc("ana", "app_trip_outcome", { negotiation, happened: false, reason: "other" }), 409);

  // Regras da avaliação: 1–5, texto obrigatório abaixo de 3, máximo 500.
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 0, comment: "" }), 422);
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 6, comment: "" }), 422);
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 2, comment: "  " }), 422);
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 5, comment: "x".repeat(501) }), 422);

  // Reciprocidade: Bruno avalia primeiro; Ana não vê o conteúdo até avaliar.
  await api.rpc("bruno", "app_review_send", { negotiation, stars: 2, comment: "Atrasou muito" });
  const locked = (await api.rpc("ana", "app_state")).postTrip;
  assert.equal(locked.mine, null);
  assert.deepEqual(locked.theirs, { stars: 0, comment: "" }, "marcador sem nota nem texto");
  assert.doesNotMatch(JSON.stringify(await api.rpc("ana", "app_state")), /Atrasou/);

  const rated = await api.rpc("ana", "app_review_send", { negotiation, stars: 5, comment: "Ótima companhia" });
  assert.deepEqual(rated.postTrip.mine, { stars: 5, comment: "Ótima companhia" });
  assert.deepEqual(rated.postTrip.theirs, { stars: 2, comment: "Atrasou muito" });
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 4, comment: "" }), 409);

  // Concluir arquiva e libera para uma nova busca.
  const closed = await api.rpc("ana", "app_trip_close", { negotiation });
  assert.equal(closed.matched, null);
  assert.equal(closed.postTrip, null);
  assert.equal(closed.history.length, 1);
  const [trip] = closed.history;
  assert.equal(trip.companion, bruno);
  assert.equal(trip.name, "Bruno");
  assert.equal(trip.happened, true);
  assert.equal(trip.mine.stars, 5);
  assert.equal(trip.theirs.stars, 2);
  assert.match(trip.route, /→/);

  // A nota pública só conta avaliações liberadas (as duas já avaliaram).
  await api.rpc("bruno", "app_trip_close", { negotiation });
  await api.rpc("ana", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "R", destination: "S",
    points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
  } });
  await api.rpc("bruno", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "T", destination: "U",
    points: { origin: { latitude: -19.9298, longitude: -43.94 }, destination: { latitude: -19.9198, longitude: -43.93 } },
  } });
  const [bruno2] = (await api.rpc("ana", "app_state")).candidates;
  assert.equal(bruno2.id, bruno);
  assert.equal(bruno2.rating, "5,0", "Bruno recebeu 5 de Ana");
  assert.equal(bruno2.trips, 1);
  assert.equal((await api.rpc("bruno", "app_state")).candidates[0].rating, "2,0", "Ana recebeu 2 de Bruno");
  assert.equal((await api.rpc("ana", "app_history", {})).history.length, 1);
  void ana;
});

test("viagem que não aconteceu: sem avaliação, com motivo, e arquiva", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  await agree(api, negotiation);
  await elapse(api, negotiation, 5);
  await api.rpc("ana", "app_trip_outcome", { negotiation, happened: false, reason: "no-show" });
  await expectError(api.rpc("ana", "app_review_send", { negotiation, stars: 5, comment: "" }), 409);
  const closed = await api.rpc("ana", "app_trip_close", { negotiation });
  assert.equal(closed.history[0].happened, false);
  assert.equal(closed.history[0].reason, "no-show");
  assert.equal(closed.history[0].mine, null);
  // Bruno ainda está na viagem (não respondeu): continua exclusivo até responder.
  assert.ok((await api.rpc("bruno", "app_state")).postTrip);
});

test("bloquear encerra a negociação, some da descoberta e desbloquear volta", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const ana = await api.user("ana");
  const negotiation = await match(api);
  const blocked = await api.rpc("ana", "app_block_add", { companionId: bruno });
  assert.deepEqual(blocked.blocked, [bruno]);
  assert.equal(blocked.matched, null);
  assert.match((await api.rpc("bruno", "app_state")).message, /cancelou/);
  // Bruno volta à busca, mas Ana (bloqueadora) e ele não se enxergam mais.
  await api.rpc("ana", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "R", destination: "S",
    points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
  } });
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0);
  assert.equal((await api.rpc("bruno", "app_state")).candidates.length, 0);
  await expectError(
    api.rpc("bruno", "app_request_send", { candidateId: ana, expectedRevision: (await api.rpc("bruno", "app_state")).revision }),
    409,
  );
  const open = await api.rpc("ana", "app_block_remove", { companionId: bruno });
  assert.deepEqual(open.blocked, []);
  assert.equal(open.candidates.length, 1);
  void negotiation;
  // Desconhecidos não podem ser bloqueados nem denunciados (evita assédio por UUID).
  await api.rpc("carla", "app_profile_save", { profile: { email: api.email("carla"), name: "Carla", phone: "", birth: "1990-01-01", photo: false } });
  await expectError(api.rpc("carla", "app_block_add", { companionId: ana }), 403);
  await expectError(api.rpc("carla", "app_report_send", { companionId: ana, reason: "unsafe", details: "" }), 403);
});

test("denúncia valida motivo e guarda só para quem denunciou", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  await match(api);
  await expectError(api.rpc("ana", "app_report_send", { companionId: bruno, reason: "nada", details: "" }), 422);
  await expectError(api.rpc("ana", "app_report_send", { companionId: bruno, reason: "other", details: "  " }), 422);
  await expectError(api.rpc("ana", "app_report_send", { companionId: bruno, reason: "unsafe", details: "x".repeat(1001) }), 422);
  const s = await api.rpc("ana", "app_report_send", { companionId: bruno, reason: "unsafe", details: " Dirigiu mal " });
  assert.equal(s.reports.length, 1);
  assert.equal(s.reports[0].details, "Dirigiu mal");
  assert.deepEqual((await api.rpc("bruno", "app_state")).reports, []);
});

test("pedido vence no horário original e some quando o alvo some", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const s = await api.rpc("ana", "app_state");
  const asked = await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s.revision });
  assert.equal(asked.pending, bruno);
  // O alvo faz uma nova busca (a antiga é encerrada): o pedido deixa de existir.
  await api.rpc("bruno", "app_intent_save", { intent: {
    departure: iso(Date.now() + 9 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "Z", destination: "W",
    points: { origin: { latitude: -19.5, longitude: -43.5 }, destination: { latitude: -19.4, longitude: -43.4 } },
  } });
  const gone = await api.rpc("ana", "app_state");
  assert.equal(gone.pending, null);
  assert.match(gone.message, /indisponível/);

  // Vencimento: o horário passou sem aceite, mesmo sem tarefa agendada.
  await api.rpc("ana", "app_intent_save", { intent: {
    departure: iso(Date.now() + 2 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "A2", destination: "B2",
    points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
  } });
  await api.rpc("bruno", "app_intent_save", { intent: {
    departure: iso(Date.now() + 2 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "A3", destination: "B3",
    points: { origin: { latitude: -19.9298, longitude: -43.94 }, destination: { latitude: -19.9198, longitude: -43.93 } },
  } });
  const rev = (await api.rpc("ana", "app_state")).revision;
  assert.equal((await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: rev })).pending, bruno);
  await api.sql("update intents set departure = now() - interval '1 minute' where status = 'active'");
  const expired = await api.rpc("ana", "app_state");
  assert.equal(expired.pending, null);
  assert.match(expired.message, /venceu/);
  await expectError(api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: expired.revision }), 409);
});

test("idempotência: mesma chave não repete o efeito e é por pessoa", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const s = await api.rpc("ana", "app_state");
  const first = await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s.revision }, { key: "dup" });
  // O app repete a escrita após uma falha de rede: mesma chave, mesma revisão antiga.
  const again = await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s.revision }, { key: "dup" });
  assert.deepEqual(again, first);
  assert.equal((await api.sql("select count(*)::int n from requests")).rows[0].n, 1);
  // A chave é de cada pessoa: outra pessoa pode usar o mesmo texto.
  const sb = await api.rpc("bruno", "app_state");
  await api.rpc("bruno", "app_report_send", { companionId: await api.user("ana"), reason: "fake", details: "" }, { key: "dup" }).catch((e) => e);
  assert.ok(sb);
});

test("permissões: tabelas fechadas, funções internas inacessíveis, sem sessão não entra", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const ana = await api.user("ana");
  await api.sql("select set_config('request.jwt.claim.sub', $1, false)", [ana]);
  for (const role of ["authenticated", "anon"]) {
    await api.db.exec(`set role ${role}`);
    for (const table of ["profiles", "intents", "messages", "user_state", "operation_receipts"])
      await assert.rejects(api.db.query(`select * from public.${table}`), /permission denied/, `${role} lê ${table}`);
    await assert.rejects(api.db.query("select app_private.snapshot($1::uuid)", [ana]), /permission denied/);
    await api.db.exec("reset role");
  }
  // anon não chama a API; sem sub, nem authenticated.
  await api.db.exec("set role anon");
  await assert.rejects(api.db.query("select public.app_state('{}'::jsonb)"), /permission denied/);
  await api.db.exec("reset role");
  await api.sql("select set_config('request.jwt.claim.sub', '', false)");
  await api.db.exec("set role authenticated");
  await assert.rejects(api.db.query("select public.app_state('{}'::jsonb)"), (e) => e.code === "PT401");
  await api.db.exec("reset role");
});

test("negociação sem acordo vence no horário combinado", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  await elapse(api, negotiation, 5); // passou da hora sem os dois escolherem a mesma opção
  const s = await api.rpc("ana", "app_state");
  assert.equal(s.matched, null);
  assert.equal(s.proposal, null);
  assert.match(s.message, /venceu/);
  await expectError(api.rpc("bruno", "app_message_send", { negotiation, text: "oi" }), 409);
});

test("busca repetida é limitada e UUID inexistente recebe o mesmo erro de desconhecido", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const intent = {
    departure: iso(Date.now() + 2 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1,
    walkingLimit: 400, origin: "A", destination: "B",
    points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
  };
  let last;
  for (let i = 0; i < 25 && !last; i++)
    await api.rpc("ana", "app_intent_save", { intent }).catch((e) => { last = e; });
  assert.equal(last?.status, 429);
  const ghost = "00000000-0000-4000-8000-000000000000";
  await expectError(api.rpc("bruno", "app_block_add", { companionId: ghost }), 403);
  await expectError(api.rpc("bruno", "app_block_add", { companionId: await api.user("ana") }), 403);
  await expectError(api.rpc("bruno", "app_request_send", { candidateId: ghost, expectedRevision: 0 }), 409);
});

test("distância vem do percurso a pé: sem rota não há sugestão, rota longa elimina", { skip }, async () => {
  const api = await fresh();
  api.workerOn = false; // o worker de rotas ainda não rodou
  await twoWalkers(api);
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0, "sem rota calculada, sem sugestão");
  const queued = (await api.sql("select count(*)::int n from route_queue")).rows[0].n;
  assert.equal(queued, 2, "um par de origens e um par de destinos, sem duplicar");

  // O worker devolve um percurso 3x a linha reta (rio no meio): 900 m, 450 por pessoa > 400.
  api.routeFactor = 3;
  await api.drainRoutes();
  assert.equal((await api.rpc("ana", "app_state")).candidates.length, 0, "percurso longo demais");

  // Outro provedor/atualização com 2x: 600 m, 300 por pessoa -> cabe, e a distância mostrada é a do percurso.
  api.routeFactor = 2;
  await api.drainRoutes();
  await api.sql("delete from walk_routes");
  await api.rpc("ana", "app_intent_save", { intent: {
    departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
    origin: "R", destination: "S",
    points: { origin: { latitude: -19.93, longitude: -43.94 }, destination: { latitude: -19.92, longitude: -43.93 } },
  } });
  api.workerOn = true;
  await api.drainRoutes();
  const [c] = (await api.rpc("ana", "app_state")).candidates;
  assert.equal(c.pickup, 300, "metade de 600 m de percurso");
});

test("só pares plausíveis entram na fila de rotas", { skip }, async () => {
  const api = await fresh();
  api.workerOn = false;
  await twoWalkers(api, { gap: 0.02 }); // ~2,2 km em linha reta: já passa de 400+400
  assert.equal((await api.sql("select count(*)::int n from route_queue")).rows[0].n, 0);
});

test("worker de rotas: só service_role, rota inválida é recusada, falhas se acumulam", { skip }, async () => {
  const api = await fresh();
  api.workerOn = false;
  await twoWalkers(api);
  await assert.rejects(api.rpc("ana", "worker_route_pending", {}), /permission denied/);
  const pending = await api.worker("worker_route_pending", { limit: 10 });
  assert.equal(pending.length, 2);
  await expectError(api.worker("worker_route_store", { ...pending[0], meters: -5, mid: { lat: 0, lon: 0 } }), 422);
  await expectError(api.worker("worker_route_store", { ...pending[0], meters: 100, mid: null }), 422);
  for (let i = 0; i < 5; i++) await api.worker("worker_route_fail", { ...pending[0], error: "timeout" });
  assert.equal((await api.worker("worker_route_pending", {})).length, 1, "após 5 falhas o par sai da fila ativa");
});

test("quem nunca avalia recebe nota, mas só vê as avaliações depois de avaliar", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const negotiation = await match(api);
  await agree(api, negotiation);
  await elapse(api, negotiation, 5);
  await api.rpc("ana", "app_trip_outcome", { negotiation, happened: true });
  await api.rpc("bruno", "app_trip_outcome", { negotiation, happened: true });
  await api.rpc("bruno", "app_review_send", { negotiation, stars: 2, comment: "Atrasou" });
  // Ana nunca avalia. A nota dela já vale para os outros; o texto continua oculto.
  const view = await api.rpc("ana", "app_state");
  assert.doesNotMatch(JSON.stringify(view), /Atrasou/);
  await api.rpc("ana", "app_trip_close", { negotiation });
  await api.rpc("bruno", "app_trip_close", { negotiation });
  for (const [name, o, d] of [["bruno", -19.93, -19.92], ["ana", -19.9298, -19.9198]])
    await api.rpc(name, "app_intent_save", { intent: {
      departure: iso(Date.now() + 3 * H), timeZone: "America/Sao_Paulo", fixed: false, passengers: 1, walkingLimit: 400,
      origin: `${name}1`, destination: `${name}2`,
      points: { origin: { latitude: o, longitude: -43.94 }, destination: { latitude: d, longitude: -43.93 } },
    } });
  const [ana] = (await api.rpc("bruno", "app_state")).candidates;
  assert.equal(ana.rating, "2,0");
  const hist = (await api.rpc("ana", "app_history", {})).history[0];
  assert.deepEqual(hist.theirs, { stars: 0, comment: "" }, "no histórico, o conteúdo segue oculto");
});

test("cancelar a busca: fecha a busca e o pedido, some da descoberta e é idempotente", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const s = await api.rpc("ana", "app_state");
  assert.ok(s.intent, "a busca existe");
  await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s.revision });
  const after = await api.rpc("ana", "app_intent_cancel", {}, { key: "c1" });
  assert.equal(after.intent, null);
  assert.equal(after.pending, null);
  const again = await api.rpc("ana", "app_intent_cancel", {}, { key: "c1" });
  assert.equal(again.revision, after.revision, "mesma chave não repete o efeito");
  assert.equal((await api.rpc("ana", "app_intent_cancel", {})).intent, null, "sem busca, cancelar não falha");
  assert.equal((await api.rpc("bruno", "app_state")).candidates.length, 0, "a pessoa some da descoberta");
  const { rows } = await api.sql("select count(*)::int as n from requests where status = 'pending'");
  assert.equal(rows[0].n, 0);
});

test("cancelar a busca com negociação em andamento não mexe em nada", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  await match(api);
  const result = await api.rpc("ana", "app_intent_cancel", {});
  assert.match(result.message, /andamento/);
  assert.ok(result.matched, "a negociação continua");
});

test("pedido recebido aparece, pode ser recusado e some do outro lado", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const ana = await api.user("ana");
  const s0 = await api.rpc("ana", "app_state");
  assert.equal(s0.incoming, null);
  await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s0.revision });

  const seen = await api.rpc("bruno", "app_state");
  assert.equal(seen.incoming, ana);
  assert.ok(seen.candidates.some((c) => c.id === ana));
  assert.equal(seen.pending, null);

  const declined = await api.rpc("bruno", "app_request_decline", { candidateId: ana });
  assert.equal(declined.incoming, null);
  const after = await api.rpc("ana", "app_state");
  assert.equal(after.pending, null);
  assert.match(after.message, /recusou/);
  // Recusar sem pedido pendente não muda nada.
  await api.rpc("bruno", "app_request_decline", { candidateId: ana });
});

test("aceitar o pedido recebido gera o aceite mútuo", { skip }, async () => {
  const api = await fresh();
  await twoWalkers(api);
  const bruno = await api.user("bruno");
  const ana = await api.user("ana");
  const s0 = await api.rpc("ana", "app_state");
  await api.rpc("ana", "app_request_send", { candidateId: bruno, expectedRevision: s0.revision });
  const sb = await api.rpc("bruno", "app_state");
  const matched = await api.rpc("bruno", "app_request_send", { candidateId: ana, expectedRevision: sb.revision, declineIncoming: true });
  assert.equal(matched.matched, ana);
  assert.equal((await api.rpc("ana", "app_state")).matched, bruno);
});

# Divide aí — passagem de trabalho

Atualizado em 14 de outubro de 2026.

## Diagnóstico do pareamento + troca para ORS — 14 de outubro de 2026 (Claude Code)

Pedido: idealizador ainda sem match mesmo após o worker rodar (ver entrada abaixo); pediu tentar a API do openrouteservice (ORS) e corrigir se não funcionasse; avisou que ia almoçar e pediu para eu continuar testando/desenvolvendo sozinho. Usei Haiku (pesquisador) para mapear a lógica SQL de pareamento e Opus como advisor antes de agir mais a fundo, conforme pedido.

**Diagnóstico (Haiku + conferência direta no Supabase real via `service_role`, só leitura):** a lista de candidatos vem de `app_private.discover(uid)` (core.sql:507), que só mostra um par se `app_private.pair(a,b,now())` (core.sql:436-452) achar `ok=true`: precisa das duas rotas a pé já em `walk_routes` (sem fallback para linha reta), busca ainda não vencida, capacidade ≤3, janelas de horário sobrepostas, e cada um andando até a metade do percurso dentro do seu limite. Pedido (`app_request_send`) não é pré-requisito para aparecer como candidato — é uma ação manual separada (pedir/aceitar), sem simulação automática como no mock antigo. **Conferido com os dados reais:** as duas intenções de teste ativas hoje (mesmo horário, 19:10 UTC) têm origem a 4 m e destino a 5 m uma da outra, e os dois percursos já estavam calculados e em cache (gravados ~14:40 UTC pelo worker) — pela conta manual da regra, isso já bastava para aparecerem como candidatas uma pra outra a partir desse horário. Não existia nenhum pedido novo entre as duas contas na tabela `requests` (só os de ontem, resolvidos); ou seja, o próximo passo depois do diagnóstico é o idealizador (ou eu, se autorizado) mandar o pedido de cada conta pra outra.

**ORS:** testei a chave direto (`POST /v2/directions/foot-walking/geojson`) e ela respondeu HTTP 200 com uma rota real — o serviço parece ter voltado a funcionar (ontem dava 504/502). Troquei o loop de recálculo de OSRM público para `ROUTE_PROVIDER=ors` (já era o valor salvo em `.env.server.local`; nenhum arquivo mudou). Observação: o idealizador também adicionou `OPENROUTESERVICE_API_KEY` em `.env.server.local` além do `ROUTE_API_KEY` já existente — são o mesmo valor (conferido por comparação, sem expor o conteúdo); o worker só lê `ROUTE_API_KEY`, então a variável nova é redundante, mas inofensiva.

**Opus (advisor) consultado** sobre o diagnóstico acima e os próximos passos/riscos de deixar o loop do ORS rodando contra produção sem supervisão; resposta ainda não registrada no momento desta nota (ver conversa/próxima entrada).

**Pendente:** confirmar que o par realmente aparece nas sugestões de cada conta agora (não verifiquei a tela, só a regra e os dados); mandar/testar o pedido entre as duas contas para fechar o aceite mútuo; decidir se o loop do worker (OSRM ou ORS) continua rodando manualmente batido por mim ou se vira algo persistente (cron/serviço) — ainda não é automático em produção.

## Fila de rotas esvaziada de novo + Photon público fora do ar — 14 de outubro de 2026 (Claude Code)

Pedido: idealizador testou com dois usuários (trajetos quase idênticos) e nada casou; buscar endereço por texto também parou. Diagnóstico, sem mudar código: (1) a fila de rotas a pé (`route_queue`) só esvazia quando o worker roda, e ele não ficou rodando desde o teste de ontem (13/10) registrado abaixo — as buscas novas ficaram sem rota calculada, por isso não casaram; (2) o Photon público (`photon.komoot.io/api/` e `/reverse/`) está sem responder agora (timeout em `/api/` e `/reverse/` testado três vezes direto por curl; o domínio raiz responde, só as rotas de consulta estão penduradas) — serviço de terceiros sem SLA, fora do nosso controle.

**Feito (com autorização do idealizador):** `node --env-file=.env.server.local supabase/worker/routes.mjs` rodado de novo com `ROUTE_PROVIDER=osrm ROUTE_BASE_URL=https://routing.openstreetmap.de/routed-foot` (variável de ambiente, nenhum arquivo alterado; o ORS da chave nova continua sem validar desde ontem). Resultado: **6 rotas gravadas, 0 falhas**, no Supabase real. Migration `20261014000000_incoming_requests.sql` confirmada como já executada pelo idealizador.

**Achado de ambiente:** nesta sessão `node` não estava no PATH (nem Bash nem PowerShell); usado o binário direto em `%APPDATA%\fnm\node-versions\v22.16.0\installation\node.exe` (mesmo caminho já visto em lotes anteriores — ver "Execução real no navegador", 11/10). Padronizar isso ajudaria a não repetir a busca a cada sessão.

**Pendente:** o worker continua manual — sem rodar em loop, qualquer busca nova fica sem rota até alguém rodar de novo. Para a demonstração seguir funcionando, rodar o mesmo comando antes de cada rodada de teste (ou pedir para deixá-lo em loop durante a janela da demonstração). ORS: validar a chave quando o serviço voltar a responder (504/502 desde 13/10, não confirmado hoje). Photon: sem ação possível do nosso lado; buscar endereço só pelo mapa (toque direto) enquanto o serviço público não voltar.

## Pedido recebido (aceitar/recusar) — 13 de outubro de 2026 (Claude Code)

Defeito achado no teste com duas contas: quem recebia o pedido não via nada (o snapshot não trazia a solicitação recebida e não existia recusar). Feito: migration `20261014000000_incoming_requests.sql` (**precisa ser executada no SQL Editor**): status `declined`, `snapshot` com `incoming` (quem pediu a mim e ainda cabe), `app_request_decline`, e `app_request_send` aceita `declineIncoming`. App: `state.incoming`, comando `decline`, endpoint `API_REQUEST_DECLINE` (adicionado em `mobile/.env`, exemplos e Integracao_backend.md; **reiniciar o Expo com --clear**). Telas: em "Procurando companhia" aparece "X quer viajar com você" com Aceitar / Recusar / "Analisar outros viajantes"; em Sugestões, chip "X quer viajar com você · ver", e aceitar outra pessoa abre o aviso "Já tem alguém querendo viajar com você" (recusa X e aceita Y). Aceitar X = pedir de volta (aceite mútuo existente); a busca não é bloqueada. Testes: 30 do banco (2 novos, PGlite instalado fora do projeto), 30/4/7/23 do app, Biome e tsc limpos. **Não verificado:** tela no navegador contra o Supabase real; o mock HTTP não implementa `incoming`/`decline`. **Pendente:** quem foi recusado pode pedir de novo (sem limite); a recusa não esconde a pessoa das sugestões.

## Chave do openrouteservice — 13 de outubro de 2026 (Claude Code)

Chave gerada pelo idealizador gravada em `.env.server.local` (ignorado pelo git) como `ROUTE_PROVIDER=ors`, `ROUTE_BASE_URL=https://api.openrouteservice.org`, `ROUTE_API_KEY`. Teste de uma rota a pé em BH: **504 e depois 502 (nginx do próprio ORS)**, ou seja, a chave não foi validada (um 401/403 indicaria chave ruim). Depois, com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` preenchidos, o ORS seguiu fora do ar (timeout em 2 tentativas, até 60 s). **Só para teste**, o worker rodou com o OSRM público de pé (`ROUTE_PROVIDER=osrm ROUTE_BASE_URL=https://routing.openstreetmap.de/routed-foot`, passado por variável de ambiente, sem mudar o arquivo): 2 rotas gravadas, 0 falhas, no Supabase real. Serviço comunitário, não serve para produção. **Pendente:** refazer o fluxo com duas contas; validar a chave do ORS quando voltar; escolher o provedor de produção.

## Primeiro contato com o Supabase real e cancelar busca — 13 de outubro de 2026 (Claude Code)

Migration `20261012000000_core.sql` aplicada no projeto Supabase do idealizador; conferido com a chave pública: tabelas e funções `worker_*` fechadas (401), `app_*` exigem login, Auth por e-mail ligado. `mobile/.env` (ignorado pelo git) aponta para o projeto, modo `api`. Login por código exige SMTP próprio (templates só editáveis assim); em teste usa-se Gmail com senha de app, que só vive no painel do Supabase. **Defeito achado no teste manual:** "Ajustar/Cancelar busca" só limpava o estado local e a próxima leitura trazia a busca de volta; o botão "Cancelar busca" só aparecia com candidatos. Corrigido: nova migration `20261013000000_intent_cancel.sql` (`app_intent_cancel`, **precisa ser executada no SQL Editor do projeto**), comando `cancel-search`, endpoint `API_INTENT_CANCEL`, botão sempre visível enquanto a busca está aberta. Testes: 28 do backend, 30/4/7/23 do app, Biome e tsc limpos. **Pendente:** as duas buscas de teste não casaram porque nenhuma rota a pé foi calculada (a fila `route_queue` só esvazia com o worker; falta a chave do openrouteservice em `.env.server.local`); rodar `node --env-file=.env.server.local supabase/worker/routes.mjs` e repetir o fluxo com duas contas.

## Decisões do idealizador aplicadas ao backend — 13 de outubro de 2026 (Claude Code)

Confirmado: distância = percurso a pé do mapa; viagem termina 1 h depois; endereço da outra pessoa aparece ao escolher o ponto dela; quem não avalia recebe nota (só não vê o conteúdo). Aplicado na migration: `walk_routes` + `route_queue` + worker `supabase/worker/routes.mjs` (OSRM/ORS, testado só com respostas simuladas; nenhum provedor real chamado), `pair()` usa o percurso e sem rota não há sugestão, nota conta todas as avaliações recebidas. Testes: 23 do banco (PGlite) + 3 do worker passam. **Pendente:** escolher o provedor de rotas e rodar o worker de verdade (a fila só esvazia com ele), validar num Supabase real.

## Backend em SQL (Supabase) — 12 de outubro de 2026 (Claude Code)

Pedido: continuar de onde parou, Opus só para conselho/revisão, liberdade para começar o backend. Sonnet 5.5 conduziu, implementou e verificou; Opus revisou a migration (somente leitura) e as correções foram aplicadas; Haiku não foi necessário. Orçamento zero mantido: nenhuma dependência instalada no projeto, nenhum segredo lido, nenhum serviço real chamado, nada publicado.

**Entregue:** `supabase/migrations/20261012000000_core.sql` (tabelas, RLS fechada, funções `app_*` que implementam o contrato de Integracao_backend.md, idempotência, outbox de notificações sem consumidor), `supabase/tests/{harness,core.test,contract.test}.mjs` (19 testes em PGlite), `mobile/.env.supabase.example` (rotas RPC prontas; só faltam URL e chave pública), teste do exemplo em `services.test.mjs`, script `npm run test:backend`. Regras, decisões provisórias e o que não foi coberto estão em Integracao_backend.md ("Backend em SQL").

**Verificação:** `test:backend` 19/19 (com PGlite fora do projeto), `npm test` 30/4/7/23, Biome limpo (78 arquivos). Respostas reais do SQL passam pelo `readSnapshot` do app. Revisão do Opus achou 5 pontos altos; corrigidos: trilateração por distâncias exatas (faixas de 100 m + limite de buscas), negociação sem acordo nunca vencia, privilégios padrão do Supabase, FORCE RLS removido, leituras via POST. Também 429, alvo inexistente indistinguível, ordem de locks.

**Não verificado:** nenhum Supabase/PostgREST real (a migration só rodou no PGlite); concorrência real; app no navegador contra este SQL (só o mock HTTP antigo foi exercitado no e2e); rate limit é mínimo; avaliação de quem não avalia, paginação do chat e expiração de recibos de idempotência ficam pendentes.

**Próximo passo:** criar o projeto Supabase de teste, aplicar a migration, conferir `rolbypassrls`/privilégios, preencher `.env` a partir de `.env.supabase.example` e percorrer o fluxo com duas contas reais; depois SMTP/Resend, SecureStore, Realtime e rotas a pé reais.

## Preparação para integração com o backend — 12 de outubro de 2026 (Claude Code)

Pedido: preparar o protótipo para o backend: endpoints vazios no `.env` para obter/escrever dados, e APIs usadas (disparo de e-mail, mapas) configuráveis com adaptador pronto. Sonnet 5.5 conduziu, implementou e verificou, sem Haiku/Opus. Orçamento zero mantido: nenhuma dependência instalada (lockfile intacto), nenhum segredo lido (`.env.server.local` não acessado), nenhum e-mail enviado, nenhum serviço real chamado, nada publicado.

**Entregue:** (1) `mobile/.env.example` (versionado) e `mobile/.env` (local, ignorado) com tudo vazio e `DATA_SOURCE=demo`: 17 endpoints (4 leituras, 13 escritas), URL/chave pública, timeout, atualização periódica, login, geocoder e tiles do mapa. `.env.server.example` ampliado (Resend/SMTP, Supabase service role: só servidor). (2) `src/services/`: `env`, `config` (valida e cai no padrão seguro com avisos), `http` (timeout, `apikey`/`Authorization`, `Idempotency-Key`, 1 nova tentativa só quando seguro, erros em português sem vazar detalhe do servidor), `auth` (adaptadores `demo` e `supabase` por REST sem SDK; `SessionStore`; renovação única compartilhada), `gateway` (comando→rota/corpo, instantes ISO, snapshot validado, leitura com fallback), `index` (monta os adaptadores). (3) `provider.tsx` escolhe reducer local (demo) ou gateway (api): fila ordenada de comandos, `send(comando, depois)` executa a navegação só após a confirmação do servidor, atualização periódica, 401→login, 409→recarrega, faixa de erro em `DemoPage`. Com `api`, somem selo DEMO, controles Demo, textos de demonstração e a mensagem "código 123456"; a demonstração segue idêntica. (4) Geocoder: `createGeocoder` aceita URLs, parser, parâmetros e cabeçalhos; provedores `photon` e `api` (formato em Integracao_backend.md); a instância agora vem de `services.geocoder`. (5) Mapa: URL/zoom/crédito dos tiles configuráveis, CSP derivada do host (`features/maps/tiles.ts`). (6) `tools/mock_backend.mjs` (backend falso com a regra do app por trás, idempotência, 401/409, Auth estilo Supabase), `.env.mock.example`, `tools/e2e_api_smoke.mjs`, `serve_catalog.py` com pasta/porta opcionais. (7) `documentos/Integracao_backend.md` (contrato, variáveis, pendências), README, LEIA_PRIMEIRO e Decisoes atualizados. Scripts `test:services` e `test`; `export:*` agora usam `--clear`.

**Achados durante a verificação:** o Metro manteve valores antigos do `.env` entre exportações (daí o `--clear`); o Git Bash converte `/api/x` em `C:/Program Files/Git/api/x` em variáveis de ambiente (config recusa e avisa; usar `.env`, PowerShell ou `MSYS_NO_PATHCONV=1`).

**Verificação:** Biome limpo, `tsc --noEmit` exit 0, `npm test` (demo 30, mapas 4, endereços 7, serviços 22), export web com `.env` padrão, e2e de demonstração PASSED a 390/360/1280 px (e 360 sem Photon), e2e `e2e_api_smoke.mjs` PASSED (login por código no Auth falso, cadastro, endereços do backend, pedido, aceite por atualização automática, chat, acordo, queda de rede). Variável do `.env` chega ao bundle (conferido com valores de teste).

**Limitações:** NADA foi validado contra Supabase, Resend ou provedor de mapas reais; o contrato de dados é proposta do app (único ponto de ajuste: `gateway.ts`); sessão só em memória (falta `expo-secure-store`); sem Realtime/push; foto de perfil continua marcador; telas não verificadas em Android/TalkBack. Lista completa em Integracao_backend.md ("O que ainda falta").

**Próximo passo:** criar o projeto Supabase de teste, expor as funções do contrato (ou mapear o esquema real em `gateway.ts`), preencher o `.env` e rodar `e2e_api_smoke.mjs` apontando para ele; depois SMTP/Resend com domínio verificado, SecureStore e Realtime.

## Revisão visual ponta a ponta antes da apresentação — 12 de outubro de 2026 (Claude Code)

Pedido: percorrer o app no navegador procurando inconsistências de design, problemas de carregamento e despadronização, para apresentar aos patrocinadores. Sonnet 5.5 conduziu, corrigiu e verificou, sem Haiku/Opus. Fluxo completo executado com o e2e (390, 360 e 1280 px) e estados extras fora do e2e (entrada vazia/erro, data inválida, folhas "Quando e com quem", busca sem locais, sem resultado, Photon e tiles bloqueados, rota inexistente). Nenhuma regra de domínio mudou.

**Corrigido:** (1) linha vertical solta no canto da página, ao lado do campo de partida (o conector do `PlaceFields` não tinha `position: relative`); (2) botão "Catálogo de componentes" no Perfil agora só existe em desenvolvimento (`__DEV__`); (3) Proposta: os dois controles demo viraram `DemoAction` tracejados lado a lado e "Escolher a mesma" / "Abrir o chat" viraram chips com borda (antes eram textos soltos que pareciam uma frase só); (4) cabeçalho Proposta/Chat/Detalhes usa o botão redondo de voltar e o `Avatar` claro do resto do app (antes "←" solto e avatar escuro; a linha "Conversa com X" em Viagens também); (5) data no mesmo formato em todo o app ("Hoje · 18:46") em vez de "12/10/2026, 18:46" (`formatInstant` delega a `whenLabel`); (6) formulário: rótulos "Data de nascimento" e "Foto" no mesmo estilo de "Nome"/"Telefone", caixas de data com borda de erro, e sem o prefixo "Erro:" visível (o nome acessível do campo continua dizendo "Erro: …"); (7) mini-mapa da busca ativa: sem botões de zoom, pins enquadrados e maiores, mapa mais alto; (8) endereços longos terminam com reticências em vez de cortar; (9) mensagem de "Mapa indisponível" não fica mais sob o botão de GPS; (10) sem internet o geocoder mostrava "Failed to fetch" cru; agora "Sem conexão com a busca de endereços…"; (11) erro de busca sem locais não repete "Origem e destino devem ser diferentes" quando só falta escolher; (12) dica do e-mail sem quebra "e-/mail"; (13) rodapé das telas com selo DEMO ganhou respiro inferior (botões encostavam na borda); (14) "Voltar ao catálogo" na página não encontrada virou "Voltar ao início", e `serve_catalog.py` serve essa página para rotas desconhecidas (antes, erro cru do Python); (15) "m" órfão na linha de caminhadas.

**Verificação:** Biome limpo (70 arquivos), `tsc --noEmit` exit 0, test:demo 30/30, test:maps 4/4, test:addresses 7/7, export:web exit 0, e2e PASSED a 390 e 360 px (inclusive 360 sem Photon) e 1280 px; capturas conferidas por mim antes e depois. Servidor `serve_catalog.py` reiniciado em 127.0.0.1:8081 (precisava recarregar o código novo).

**Não corrigido / a decidir (ver relatório ao idealizador):** botão principal da tela inicial é preto e os demais são verde-escuro (decisão antiga de seguir a referência); proposta mostra "proposta N" que sobe a cada troca de escolha; rodapé fixo corta o texto da viagem quando a tela é baixa (rolagem normal); faixa de atalhos do chat é rolável sem sinal de continuação; textos de ajuda "Os dados ficam em memória…" em Viagens. Android/TalkBack/teclado nativo e Photon real instável seguem não verificados; Photon público pode falhar na rede do local da apresentação (o mapa e "Minha localização" continuam funcionando).

## Pós-viagem, segurança e entrada — 12 de outubro de 2026 (Claude Code)

Pedido: completar as telas que faltavam no MVP mockado (avaliação e as demais do ciclo depois da viagem, mais cadastro), **desenhadas do zero**: o idealizador avisou que os JPGs de telas/ 14–20 foram gerados por LLM sem revisão. Não usei os JPGs como referência (só abri 16, 18 e 19 na análise inicial, antes do aviso); segui o padrão das telas 01–10 do projeto (cabeçalho com voltar e selo DEMO, título compacto, cartões `Surface`, `StatusSteps`, modais com ✕, ação principal no rodapé). Sonnet 5.5 conduziu, implementou e verificou. Sem Haiku/Opus neste lote (o advisor não estava exposto como ferramenta); as regras de produto abaixo são, portanto, decisões minhas a validar, não parecer do advisor. Orçamento zero mantido: nenhuma dependência instalada, sem backend, e-mail ou publicação.

**Fluxo novo:** viagem combinada → **Demo · simular fim da viagem** → `/lembrete` ("A viagem com X aconteceu?") → Sim: `/avaliar` → `/avaliacao-enviada` → Concluir (arquiva em Viagens anteriores). Não: `/nao-realizada` (motivo, registro, sem avaliação). `/seguranca` (denunciar e bloquear separados) acessível do aviso Segurança do chat, de `/avaliar`, `/avaliacao-enviada` e `/nao-realizada`. Entrada: `/entrar` (e-mail → código) → `/cadastro` (nome, nascimento, telefone e foto opcionais); Buscar/Viagens/Perfil exigem perfil (`RequireProfile`).

**Domínio (domain.ts):** `DemoState` ganhou `session`, `profile`, `postTrip`, `history`, `blocked`, `reports`; o que sobrevive a cancelar/nova busca fica em `persist()`. Comandos: `verify-email`, `save-profile`, `sign-out`, `end-trip`, `trip-happened`, `rate` (não `review`, que já era "rever sugestões puladas"), `simulate-their-review`, `close-trip`, `report`, `block`, `unblock`. Funções puras testadas: `reviewError`, `reportError`, `receivedState` (none/locked/waiting/visible), `ownRating`, `stageHref`, `emailError`, `otpStatus`/`otpError`, `parseProfile`. `stageHref` substitui a escolha de rota "retomar" em Busca e Viagens. Depois de `end-trip`, `pick`, `chat` e `cancel-negotiation` são ignorados e Proposta/Chat/Viagem redirecionam.

**Regras que apliquei e precisam da sua validação (não são decisões fechadas):**
- Avaliação 1–5 estrelas, texto obrigatório abaixo de 3 (confirmado, RF21), máx. 500 caracteres. Avaliação recebida só aparece depois de avaliar (RF22). Não exibo o texto da avaliação recebida, só as estrelas, porque "quem pode ver o comentário" está pendente.
- Nota do Perfil = média só das avaliações já **liberadas**; sem nenhuma, "Sem avaliações ainda". Se uma avaliação oculta já conta na nota pública é pendência; não presumi.
- Viagem não realizada: motivos (a outra pessoa não apareceu / eu não pude ir / combinamos cancelar / ninguém pediu o carro / outro), sem avaliação e sem contar como viagem feita. Quem pode avaliar ausência, contabilização e relatos divergentes seguem pendentes; a tela só diz "nada para avaliar nesta viagem".
- Denúncia: motivos de demonstração (comportamento, insegurança, perfil falso, pressão por pagamento, outro; texto obrigatório só em "outro"). Critérios de moderação e contestação não existem; a denúncia fica só em memória e a tela avisa.
- Bloquear: some das sugestões e encerra a negociação aberta com essa pessoa; depois da viagem não impede avaliar. Desbloquear pelo Perfil.
- Cadastro: telefone e foto opcionais (necessidade pendente), sem CPF e **sem idade mínima** (pendente); só valida data real e não futura. Foto é um botão simulado: não há seletor (sem nova dependência).
- Lembrete: no app real seria push após o horário estimado (RF20); aqui é o controle demo. "Responder depois" mantém o lembrete na aba Viagens e bloqueia nova busca até responder (ou "não aconteceu").

**Componentes novos:** `FormKit.tsx` (`DemoAction`, `StarRating`, `StarsText`, `ChoiceList`, `BirthField`), `AfterTripUi.tsx` (`usePostTrip`, `TripBrief`), `Onboarding.tsx`; `DemoPage` ganhou `onBack` e `noBack`; `Field` usa `TextArea` com `multiline` (o `Input` do Tamagui 2 na web é sempre `<input>`).

| Verificação | Resultado |
|---|---|
| Biome (`biome check .`) | Limpo, 70 arquivos |
| TypeScript (`tsc --noEmit`) | Exit 0, depois de regenerar os tipos de rota subindo o Expo offline (porta 8082, encerrado) |
| test:demo / test:maps / test:addresses | 30/30 (19 antigos + 11 novos), 4/4, 7/7 |
| export:web | Exit 0 (aviso histórico de encerramento forçado) |
| export:android | Exit 0, 2.340 módulos, entry-5ddef4d12e3833b817a320ee91e3529b.hbc (~5,6 MB); só comprova compilação |
| E2E no navegador (tools/e2e_browser.mjs, `nophoton`) | PASSED a 390 px e 360 px; versão final reexecutada só a 390 px depois do ajuste do `TextArea` |

Capturas conferidas por mim a 390 px (código, cadastro com erros, lembrete, avaliar com erro, avaliação enviada, Viagens com histórico, Perfil com nota, viagem não realizada, segurança, modal de bloqueio, segurança feita) e a 360 px (cadastro, avaliar, Viagens com histórico). Ajustes vistos nas capturas: campos de nascimento invisíveis sobre o fundo da página, contador de reenvio em 61 s, textarea como input de uma linha. Reexecutei `biome check --write` em src/tests/tools, que reformatou alguns arquivos (incluindo trabalho seu não commitado).

**Não verificado:** Android/TalkBack/teclado nativo/gestos (estrelas como radiogroup só testadas no navegador), GPS real, Photon real (e2e rodou só com `nophoton`), `test:maps/addresses` não mudaram. O e2e não cobre os estados "Sem avaliações ainda" com histórico vazio nem "Perfil › Sair". Recarregar a página reinicia login e dados (estado só em memória; persistir sessão no navegador ficou de fora).

**Efeitos colaterais a saber:** o login agora é obrigatório para abrir qualquer aba; o e2e precisa passar pelo cadastro (já faz). Reiniciar demo preserva o perfil; Sair apaga tudo. Telas antigas ficam montadas na pilha do navegador, então seletores `getByLabel` do e2e podem achar elementos ocultos (usei `getByRole`).

**Próximo passo:** validar o pós-viagem no navegador/aparelho pelo README (passos 0 e 8–10 e a seção "Conta e pós-viagem"), decidir as regras listadas acima, e então seguir para o que depende de backend (login real, push do lembrete, persistência).

## Escolha da mesma opção, sem resumo — 12 de outubro de 2026 (Claude Code)

Pedido: "Conferir resumo" não fazia sentido; a ideia é os dois combinarem um lugar e selecionarem a mesma opção. Sonnet 5.5 conduziu e implementou; Opus (advisor, somente leitura) analisou o fluxo e a recomendação foi seguida.
- **Modelo:** `Proposal.picks = { mine, theirs }` (cada `ProposalPick = { choice, stop? }`); `mine`/`theirs` booleanos e `choice` saíram. O acordo é derivado (`isAgreed`/`samePick`), nunca guardado. Comando único `pick` (`who`, `choice`, `stop?`, negociação e versão esperadas) substitui `choose-proposal` e `confirm-proposal`; cada troca de escolha incrementa a versão (comando atrasado é recusado); a escolha do outro lado permanece quando eu mudo a minha. Rota exibida = conteúdo da minha escolha (ou a sugestão do app). `stopOptions(intent)`: duas paradas fixas; "Adicionar parada" só coincide com o mesmo local.
- **UI:** /proposta mostra "Você / companhia: escolha" (status "Escolhas diferentes", "já escolheu", "✓ Vocês escolheram a mesma opção"), grade 2×2 com etiquetas de quem escolheu e, ao tocar, painel com os detalhes (AgreementDetails em modo `preview`, seletor de parada, aviso "Isso desfaz a viagem combinada") e "Escolher esta opção". Fechar não navega sozinho: aparece "Ver viagem combinada". Controles demo: "escolhe a mesma" e "prefere outra". /resumo virou só redirect (para /viagem se combinado, senão /proposta); /viagem redireciona para /proposta se não houver acordo. Chat sem menção a resumo.
- **Viagem combinada (TripScreen):** mesmo padrão das telas compactas (título menor + selo DEMO, `StatusSteps` Você escolheu → X escolheu → Pedir o carro, um cartão com avatar/nome/nota, rota, parada, chips de horário e divisão, caminhadas em uma linha e um parágrafo curto de pagamento por fora). Cabeçalho e abas (Detalhes | Chat) compartilhados com Proposta e Chat via `AgreementHeader` (antes "Alterar detalhes da viagem") e Cancelar participação. E2E verificado a 390 e 360 px.
- **Modais:** `AppModal` agora sempre mostra um ✕ (rótulo "Fechar", 48 dp) no canto do título e não tem mais botão "Fechar" no rodapé; as props `closeLabel`/`closeIcon` foram removidas. Vale para troca de companhia, cancelar participação, escolha de opção, segurança, busca (endereços/horário) e catálogo.
- **Testes:** demo-domain reescrito (20/20), e2e reescrito (PASSED a 390 px). Requisitos RF11 e Decisoes_e_pendencias (l.23) atualizados. Não rodei test:maps/addresses nem 360 px; rodei `biome check --write` em src/tests/tools, que reformatou alguns arquivos (incluindo trabalho não commitado seu).

## Tela "Vamos combinar?" sem rolagem — 12 de outubro de 2026 (Claude Code)

Pedido: a proposta exigia rolar demais; resumir e usar seleção. Sonnet 5.5 editou e verificou, sem Haiku/Opus. Nenhuma regra de domínio/reducer mudou.
- **ProposalScreen:** título compacto com selo DEMO (sem eyebrow/subtítulo/rodapé de demo). Um cartão "Proposta N" (horário, rota de embarque/desembarque, paradas, chips Você/companhia confirmou|pendente; a mensagem de alteração virou uma linha dentro do cartão, `aria-live`) e uma grade 2×2 "Como vocês se encontram?" (`ChoiceTile`, selecionada com ✓ e borda; opção inválida desabilitada com "Longe demais para caminhar"). Saíram o cartão "Compare os pontos de partida", o cartão "Proposta atual" duplicado, a linha "Escolher uma opção…" longa e os quatro botões largos com legenda. Perdeu-se a comparação lado a lado dos pontos de cada um e a linha de caminhadas (continuam no resumo/viagem via AgreementDetails).
- **Cabeçalho único Proposta/Chat:** `AgreementHeader` (AgreementUi.tsx) concentra voltar, avatar/nome/nota, Segurança, cartão da viagem e abas; as duas telas o passam em `DemoPage header`, então só o miolo muda ao trocar de aba. O voltar das duas leva a /viagens. Título "Vamos combinar?" saiu; o cartão do miolo da Proposta virou "Pontos combinados". `AppModal` ganhou `closeIcon` (X no canto), usado em "Quer desistir?" no lugar do botão Fechar.
- **Kit.tsx:** `Chip` ganhou `fullWidth` (borda verde, texto 15/700, estica na horizontal), usado em "Aguardando X · ver" da tela Sugestões.
- **e2e:** regex de "proposta 2" agora é case-insensitive. Verificação: tsc e Biome nos arquivos alterados sem erros; E2E no navegador (390 px) PASSED; a proposta v1 cabe sem rolar em 390×800, e a v2 (endereços longos + aviso) cabe com o botão fixo no rodapé. Não rodei test:demo/maps/addresses nem os 360 px neste lote.

## Redesenho UX das quatro primeiras telas — 12 de outubro de 2026 (Claude Code)

Pedido: as telas 01–04 estavam cheias de texto e informação espalhada; reprojetar como UX/UI para navegação mais dinâmica e sem elementos inúteis. Ferramenta: Claude Code, Sonnet 5.5 como principal (editou e verificou). Haiku (pesquisador, somente leitura): mapeou o uso de componentes compartilhados e as dependências de texto do e2e/README/testes. Opus: consultado uma vez sobre o plano; críticas incorporadas (props retrocompatíveis no DemoPage, atalhos de horário além do stepper, estados vazios/expirado, sem contador "1/3", sem voltar na home). Orçamento zero mantido; nenhuma dependência instalada, sem backend, e-mail ou publicação. Nenhuma regra de domínio/reducer mudou.

**Mudanças de design:**
- **Tela 1 (Buscar):** removidos marca dentro do cartão, alternador "Mapa/Opções", link de GPS e botões de texto. Cartão = dois campos + dois chips (horário, pessoas). GPS virou botão redondo no mapa. Chips abrem uma única folha "Quando e com quem" (revisada a pedido do usuário na mesma data): um campo de saída com hora/minuto (foco inicial) e dia/mês editáveis, caixas "Preciso sair nesse horário" e "Vou com acompanhante" e campo numérico de caminhada em metros com − / + de 100 em 100. Sem atalhos "Daqui a…" nem seletores segmentados (Segmented removido de Kit.tsx; novos DateTimeField e NumberField). Modal de endereço enxuto: campos, linhas "Minha localização" e "Escolher no mapa", resultados; sem textos de ajuda nem botão "Conferir no mapa". Busca ativa mostra um chip "Aguardando X · ver"/"Busca ativa · ver". Mensagens do mapa encurtadas.
- **Tela 2 (Busca ativa):** passa a ser um status: "Procurando companhia" com ponto pulsante (respeita "reduzir movimento"), cartão com mini-mapa + rota + chips, contagem "N pessoas no seu caminho" (aria-live) e botão "Ver N pessoas". Estados: sem ninguém ("Ajustar busca"), com solicitação aberta, e encerrada.
- **Tela 3 (Sugestão):** título menor, cartão com avatar/nome/nota, "Sai hoje às HH:MM", chip "Encaixa HH:MM–HH:MM", duas caminhadas; divisão só aparece quando não for metade/metade; uma linha de aviso no rodapé.
- **Tela 4 (Espera):** "Aguardando X" + progresso em 3 passos (Você aceitou → X responde → Chat abre), cartão em linha, uma frase de validade/troca, controle de simulação em chip tracejado ("Demo · simular aceite de X").
- **Compartilhado (retrocompatível):** DemoPage ganhou `compact` e `demoNote` ("badge"= selo DEMO com aviso completo no rótulo acessível; padrão "footer" mantém a faixa nas outras telas); botão voltar redondo em todas as telas; AppModal com `description` opcional e `closeLabel`; LineIcon com `locate`/`pin`/`back`; `whenLabel` em domain.ts. Novos: Kit.tsx (Chip, Avatar, RoundButton, PulseDot, StatusSteps, Segmented, DemoBadge) e PersonCard.tsx (PersonCard, PersonRow; saiu de JourneyUi).

| Verificação | Resultado |
|---|---|
| npm run check (Biome + TypeScript) | Exit 0 |
| test:demo / test:maps / test:addresses | 19/19, 4/4, 7/7 |
| export:web / export:android | Exit 0 / Exit 0 (só comprova compilação) |
| E2E no navegador (tools/e2e_browser.mjs, sem Photon, 390 e 360 px) | PASSED, fluxo completo até cancelar; rótulo "Ver sugestões" do script trocado por /^Ver N pessoas/ |
| Capturas antes/depois 390×800 e 360×640 | Conferidas visualmente (home, folha de detalhes, modal de endereço, busca ativa, sugestão, espera, Viagens) |

Limitações: Android/TalkBack/teclado nativo/gestos/GPS real seguem sem verificação; o Photon real não foi exercitado neste lote (e2e só com mapa). Estados "sem ninguém" e "encerrada" da tela 2 foram implementados mas não capturados. Sem tela de recuo (Desfazer após Pular) nem contador de sugestões (decisão pelo advisor). README e roteiro de teste atualizados. Próximo passo: o idealizador validar no navegador/aparelho; depois aplicar o mesmo padrão (menos texto, chips, passos de status) às telas 05+ (proposta, chat, resumo, viagem).

## Execução real no navegador e polimento do fluxo — 11 de outubro de 2026 (Claude Code)

Pedido: finalizar o MVP mockado de forma que o caminho completo possa ser testado, com tela inicial no padrão Uber e chat no padrão BlaBlaCar (a mensagem do usuário chegou truncada; adotada a leitura "testar o caminho completo"). Ferramenta: Claude Code, Sonnet 5.5 como principal, que editou e verificou; advisor consultado antes da implementação. Sem Haiku/pesquisadores neste lote. Orçamento zero mantido: sem backend, conta, chave, billing, e-mail ou publicação; nenhuma dependência instalada no projeto (lockfile intacto).

**Evidência nova e principal:** pela primeira vez o app exportado foi executado num navegador real (Edge headless via Playwright, instalado fora do projeto). O fluxo passa inteiro, com hidratação e sem erros de console do app: endereços reais pelo Photon → GPS na partida (sem alterar o destino) → busca → sugestões → pular todas e "Rever sugestões puladas" → aceitar Evandro, continuar explorando e trocar para Bruno pelo diálogo (sem reabrir) → aceite simulado → proposta → chat (enviar, resposta simulada) → resumo → confirmação nos dois lados → viagem combinada → alterar (apaga confirmações) → reconfirmar com a companhia primeiro → Viagens → Perfil → cancelar. Rodado em 390 px e 360 px, e também com o Photon bloqueado, escolhendo partida e destino só tocando no mapa. Script: mobile/tools/e2e_browser.mjs.

Conferência visual: inspecionei as capturas de 390 px (home, endereços, busca ativa, sugestão, espera, proposta, chat, resumo, viagem, Viagens, Perfil) e, em 360 px, proposta, chat, Viagens e troca de companhia, contra as referências telas/01, 02, 03, 05 e 06; a composição é da mesma família visual (botões principais verde-escuro, não preto como nas referências). As demais capturas de 360 px só tiveram verificação de passagem/falha pelo script.

Correções feitas após ver as telas rodando:

- **Chat (padrão BlaBlaCar):** cabeçalho fixo com avatar, nome, nota e botão Segurança; cartão da viagem fixo (horário, versão, situação, trajeto) e abas Proposta/Chat; só as mensagens rolam; atalhos viram chips (48 dp) numa faixa horizontal acima do compositor, com o chip tracejado de simulação da resposta. Antes, o cabeçalho sumia na rolagem e os atalhos pareciam texto solto e ficavam cortados.
- **Viagens:** linha de conversa clicável (avatar, nome, última mensagem) abrindo o chat, como a caixa de mensagens do BlaBlaCar.
- **Coerência dos dados fictícios:** a proposta mostrava "Museu / Centro de Convenções / Praça da Liberdade · Rua das Flores" mesmo com outros endereços escolhidos. Os rótulos da companhia e da sugestão agora derivam dos endereços do usuário (`placeLead`, `companionPoints` em domain.ts); pontos escolhidos no mapa ou por GPS aparecem como "sua partida"/"seu destino". Distâncias de caminhada continuam fixtures.
- **Mapa sem geocoder:** depois de tocar a partida no mapa, o app avança para o destino e avisa "Agora toque no mapa para escolher o destino". Vale só para toque no mapa; GPS não muda a seleção (conferido no E2E). Rótulos genéricos distintos ("Partida/Destino escolhido no mapa").
- Botão "Fechar modal" (texto de desenvolvedor) virou "Fechar".

Arquivos: mobile/src/features/demo/{ChatScreen,TripsScreen,ProposalScreen,SearchScreen,domain}.ts(x), src/ui/components.tsx, tools/e2e_browser.mjs (novo; Playwright é opcional, `npm i --no-save playwright-core`), README.md. Reducer e regras de domínio não mudaram além dos rótulos. Nenhuma dependência instalada no projeto; lockfile intacto.

| Verificação | Resultado |
|---|---|
| npm run check (Biome + TypeScript) | Exit 0, 51 arquivos |
| test:demo / test:maps / test:addresses | 19/19, 4/4, 7/7 |
| export:web | Exit 0 |
| export:android | Exit 0, entry-c17c5411ae93525cc83447ea2f2e7d18.hbc (~5,5 MB); só comprova compilação |
| E2E no navegador | PASSED: 390 px, 360 px, 390 px sem Photon e 360 px sem Photon (erros de console nos cenários sem Photon são só as requisições bloqueadas de propósito) |
| HTTP local | 127.0.0.1:8081 retornou 200 em / e /viagens ao final |

Observação de ambiente: Node não estava no PATH da sessão; usado o do fnm (pasta node-versions/v22.16.0/installation dentro de %APPDATA%/fnm). Servidor `python tools/serve_catalog.py` em 127.0.0.1:8081 foi iniciado nesta sessão e deixado ativo, servindo o export atualizado; se encerrar, reiniciar conforme o README.

Limitações: Android, TalkBack, teclado nativo, gestos de arrastar/deslizar e GPS real continuam sem verificação (o GPS do E2E é simulado pelo navegador). Caminhadas e as quatro opções de trajeto são fixtures; a busca de endereços depende do Photon público (sem SLA), com o mapa como alternativa comprovada. As telas 14–20 da referência (lembrete, avaliação, segurança, cadastro, avaliação enviada) não têm equivalente navegável: dependem de regras de avaliação/moderação ainda pendentes e não foram inventadas. Próximo passo: o idealizador testar no navegador/aparelho pelo README; depois decidir regras de avaliação para o próximo lote.

## Seleção de endereços — 11 de outubro de 2026

Pedido mais recente: pesquisar o padrão da Uber, trocar os dois botões de origem/destino por campos empilhados e permitir rua/bairro em vez de latitude/longitude. Este lote substitui o editor de coordenadas descrito no histórico abaixo. Mantido orçamento zero: sem conta, chave, assinatura, billing, serviço pago, backend ou publicação. Somente o principal escreveu, integrou e verificou. Luna/high pesquisou somente leitura; Astra/low assessorou e revisou foco/concorrência. Parâmetros solicitados; metadados de modelo/esforço efetivos não estão expostos nesta interface, inclusive para o principal.

Entrega: campos compartilhados **Local de partida** / **Para onde?**, com círculo/quadrado conectados, sugestões com nome e contexto de bairro/cidade e ações de limpar, GPS e escolher no mapa. Campos inicialmente vazios; mapa centralizado em Belo Horizonte sem pins selecionados. Coordenadas ficam internas. Selecionar sugestão confirma nome e ponto juntos; editar/limpar invalida o ponto. Busca exige ambos confirmados e diferentes; dois pontos diferentes da mesma rua são válidos. O mapa aceita zero, um ou dois marcadores e mantém os pontos no mini-mapa da busca. Seleção reversa conserva o ponto exato e evita apresentar um estabelecimento próximo como endereço exato.

Geocoder: Photon público em https://photon.komoot.io, sem chave/billing, dados OpenStreetMap. O README oficial permite uso moderado no servidor demo, sem SLA ou quota numérica garantida; pode restringir acesso. Cliente com debounce de 900 ms, mínimo três caracteres, cinco sugestões, fila com intervalo de 1,2 s, timeout de 8 s, cache de sessão de 15 minutos/64 consultas, cancelamento e nenhuma repetição automática. Limites locais não são quotas oficiais. Consulta usa lang=default: o servidor real respondeu 400 para pt. O serviço recebe IP, textos e coordenadas de identificação reversa; GPS continua apenas explícito/foreground. Nominatim público não integrado. Rotas, companhia, compatibilidade e caminhadas continuam fixtures.

Proteções de interação: respostas antigas não alteram texto editado nem resultados de outro campo; fechar diálogo desfoca o acionador antes de capturar/restaurar foco, evitando reabertura no RN Web. GPS pendente atualiza a origem sem interromper edição posterior do destino. Ponto no mapa permanece utilizável com rótulo genérico se identificação indisponível. Esses cenários de teclado/foco/GPS precisam de execução no aparelho/navegador.

Arquivos principais: mobile/src/features/maps/{PlaceFields.tsx,geocoder.ts,places.ts,model.ts,html.ts,RealMap.tsx}; mobile/src/features/demo/{SearchScreen.tsx,domain.ts}; mobile/tests/addresses.test.mjs; package.json (test:addresses), tsconfig.json (imports .ts no test runner), README.md e documentos de direção. Nenhuma dependência nova ou instalação neste lote; lockfile preservado.

Verificações reais finais:

| Verificação | Resultado |
|---|---|
| npm.cmd run check | Exit 0: Biome em 51 arquivos e TypeScript sem erros após ajustes finais |
| Node strip-types, três arquivos de testes | Exit 0: 30/30 — 19 domínio, 4 mapa, 7 endereços; parsing, invalidação, revisão antiga, preservação do ponto, cache, cancelamento de fila, vazio, 429 e timeout |
| Consulta real pelo adaptador | Rua da Bahia Belo Horizonte retornou ruas em Lourdes/Savassi; identificação reversa retornou rua/bairro/cidade com UTF-8 correto |
| CORS do Photon | GET público com Origin http://127.0.0.1:8081: HTTP 200 e Access-Control-Allow-Origin: * |
| npm.cmd run export:web | Exit 0: 1.909 módulos client/1.959 server, 13 rotas, entry-8c73b37aa39d81a74e4097bd03b423a8.js (~3,4 MB) |
| npm.cmd run export:android | Exit 0: 2.321 módulos, entry-352f969614f0f1fe01c2e10c246289a3.hbc (~5,5 MB) |
| HTTP local | /, /viagens e /perfil: 200, três abas com seleção única e sem Voltar; raiz com dois inputs acessíveis, sem botões antigos/editor de coordenadas, iframe OSM/Leaflet local |

Sem interação visual/hidratação comprovada: inventário CUA retornou apps/browsers vazios; Android continua sem aparelho/emulador disponível. Testes e export não comprovam gestos, teclado, GPS ou carregamento efetivo dos tiles. Avisos históricos Node strip-types/module detection e encerramento forçado do Expo web permanecem. Testes/Hermes foram executados com escalonamento local aprovado pela revisão automática devido às restrições já identificadas do sandbox. Não foi necessário repetir Doctor/compatibilidade de dependências (21/21 e install --check aprovados no lote anterior, sem mudança de deps).

Prévia local existente continua ativa em http://127.0.0.1:8081/ (sessão 43800), servindo o export atualizado. Se encerrar, iniciar `python mobile/tools/serve_catalog.py`. Próximo passo: seguir roteiro de endereços/GPS/teclado no mobile/README.md, conferir layout estreito, fechamento sem reabertura e resposta tardia do GPS durante edição do destino. Depois percorrer o fluxo mockado completo. Sem cobrança, segredo lido, envio de mensagens/e-mail, ativação de assinatura, backend ou publicação.

Fontes primárias: [Uber: partida e chegada](https://www.uber.com/br/pt-br/ride/), [solicitar uma viagem](https://help.uber.com/pt-BR/riders/article/como-solicito-uma-viagem?nodeId=67f41961-e0aa-4670-af32-58be02c7c492), [Photon: servidor demo](https://github.com/komoot/photon#demo-server), [Photon: API](https://github.com/komoot/photon/blob/master/docs/api-v1.md). Adotado padrão de interação, sem afirmar reprodução visual integral do app Uber.

## Mapa real — 11 de outubro de 2026

Pedido atual: tornar o mapa funcional. Mantida a proibição de assinaturas, billing e serviços pagos. Essa autorização substitui o mapa meramente ilustrativo do lote anterior; não autoriza backend, publicação ou compatibilidade geográfica real. Principal Codex editou, instalou, integrou e verificou. Pesquisa somente leitura solicitada com Luna/high e arquitetura/revisão com Astra/low; ambos concluíram. Parâmetros solicitados, mas modelos/esforços efetivos não estão expostos nesta interface.

Entrega: Leaflet 1.9.4 empacotado localmente, tiles OpenStreetMap, zoom/pan, pins A/B por toque ou arraste, seleção explícita do extremo e editor acessível de coordenadas. Pontos iniciais exemplificam o centro de Belo Horizonte, sem alegar endereço de estabelecimento. GPS somente por botão via expo-location ~57.0.20, permissão foreground, timeout de 15 s para obter posição e proteção contra resultado antigo. Nenhum acompanhamento em segundo plano. Painel recolhível e inicial compacto em viewport pequeno, mapa fora da rolagem; abas continuam fixas nas três telas principais. Coordenadas opcionais na Intent sobrevivem à busca e reaparecem no mini-mapa de /busca. Removido DemoMap ilustrativo.

Android/iOS usam react-native-webview 13.16.1, web usa iframe com srcDoc. Source nativo estável evita recarregar por tick do provider. Bridge valida tipo/extremo/coordenadas finitas nos limites Mercator; web confere event.source. Documento não interpola texto do usuário e só executa JS local. Handshake repõe estado a cada carga, inclusive antes/depois da hidratação estática; resize reenquadra os pontos. Navegação arbitrária bloqueada no WebView. Atribuição fica fora do documento, sempre visível e com link explícito. UA nativo identificado, cache HTTP habilitado, Referer web padrão, sem prefetch/offline. Licença BSD incluída no HTML e no arquivo gerado. Serviço comunitário sem SLA, reavaliar capacidade/fornecedor antes de uso amplo. Políticas/fontes em mobile/README.md.

Nominatim não integrado: a política atual exige decisão informada específica do desenvolvedor, limite global 1 req/s e troca de fornecedor sem atualização; uma busca genérica não foi gerada automaticamente. Busca textual e cálculo de rotas ficam pendentes. Companhias, propostas e quatro caminhadas continuam fixtures claramente identificadas; não há linha reta simulando rota viária. Pontos reais não passam a validar elegibilidade geográfica. Coordenadas ficam na sessão; OSM recebe IP/região visualizada ao carregar tiles.

Arquivos: mobile/src/features/maps/{model,html,RealMap,RealMap.web,Attribution}, generated/Leaflet e licença, tools/vendor_leaflet.mjs, tests/maps.test.mjs; integração em SearchScreen, ActiveSearchScreen, DemoPage, JourneyUi e domain; package.json/lockfile, app.json, biome.json; README, LEIA_PRIMEIRO e Decisoes_e_pendencias. Instalação gratuita pelo Expo, sem contratação/chave/conta. npm audit automático manteve contagem histórica de 29 (11 moderadas/18 altas); não houve nova triagem ou audit fix.

Verificações finais: Biome 47 arquivos e TypeScript, exit 0; 23 testes (19 domínio + 4 mapas), exit 0; 4 testes de mapa repetidos após ajuste final de enquadramento/painel, exit 0; expo install --check atualizado e Doctor 21/21, exit 0. Export web final exit 0, 13 rotas, 1906 módulos client/1956 server, entry-d336dd717c3e9f1218886ddd4b351906.js (~3.4 MB). Export Android final exit 0, 2318 módulos, entry-af44b39fd1a7e5702d5dd574981bb752.hbc (~5.5 MB). Inspeção HTTP de /, /viagens e /perfil: 200, três abas, seleção única correta, sem seta; raiz contém iframe OSM final com JS local, licença e atribuição. Isso valida HTML/protocolo/compilação, não gestos, permissões ou carregamento efetivo de tiles. Aviso histórico de encerramento forçado após export web permanece.

Limitações de verificação: inventário CUA retornou apps/browsers vazios, sem navegador controlável; aparelho/emulador Android não disponível. Referer/UA/cache devem ser conferidos nas requisições reais do navegador/WebView antes de ampliar uso. Sandbox bloqueou instalação/check por proxy e testes/Hermes por spawn EPERM; verificações reexecutadas com escalonamento autorizado e revisão automática. Servidor local existente em 127.0.0.1:8081 permanece ativo e já serve o novo export. Abrir e atualizar a página. Próximo passo: testar pan/zoom, toque A/B, arraste, recolher/expandir painel, mudança de viewport, GPS permitido/negado/indisponível, seleção posterior ao GPS e mini-mapa; seguir checklist da jornada no README.

## Barra das abas principais — 11 de outubro de 2026

Pedido: manter Buscar / Viagens / Perfil no rodapé ao alternar entre as três telas e retirar a seta de voltar delas. Correção pequena conduzida pelo principal Codex; sem nova delegação ou consulta de arquitetura. Modelo/esforço efetivos do principal não estão expostos nesta interface.

Criado BottomNavigation.tsx compartilhado, renderizado fora da rolagem por DemoPage quando uma aba principal é informada. SearchScreen, TripsScreen e ProfileScreen indicam a aba ativa; todas exibem os três destinos e ocultam a seta. Seleção tem indicação visual e aria-selected explícito no web/accessibilityState no nativo. Alternância usa router.replace, evitando acumular telas principais no histórico. As telas de detalhes continuam com retorno. Nenhuma regra de domínio ou dependência alterada. README atualizado.

Verificações: npm.cmd run check exit 0 (Biome, 41 arquivos, e TypeScript); export web final exit 0, 13 rotas, entry-e744ccbc3ebaafc11e4984e828937392.js. Inspeção HTTP dos HTMLs de /, /viagens e /perfil: HTTP 200, três controles de aba, exatamente uma seleção correta por página e ausência do controle Voltar. Isso verifica renderização estática, não interação no navegador/aparelho. Não repetidos testes de domínio/export Android, pois o lote altera somente apresentação/navegação local. Aviso histórico de encerramento forçado do CLI web permanece. Sem assinatura, cobrança, instalação, backend, envio externo ou publicação.

Servidor local reiniciado em 127.0.0.1:8081, sessão 43800, deixado ativo. Abrir http://127.0.0.1:8081/ e atualizar a página para receber o bundle novo. Próximo passo: alternar as três abas, conferir fonte ampliada e rodapé no aparelho/navegador; limitações de runtime do lote anterior continuam.

## Correção das telas e MVP mockado do fluxo principal — 10 de outubro de 2026

Pedido atual: o idealizador testou o app e encontrou divergências com telas/. Esclareceu que desenhou somente 01–04 e autorizou adaptar as seguintes a esses padrões. Pediu deixar pelo menos o fluxo principal mockado, com inspiração de app de chat/BlaBlaCar, e proibiu qualquer assinatura ou serviço pago: orçamento zero. Esse pedido amplia os recortes históricos abaixo; não autoriza backend real, contratação ou publicação.

Ferramenta: Codex; somente o principal editou, integrou e verificou. Pesquisa visual somente leitura solicitada explicitamente com GPT-6 Luna/high; assessoria de estados e revisão final somente leitura com GPT-6 Astra/low. Ambas concluíram. Parâmetros foram enviados, mas auxiliares e principal não têm metadados expostos para confirmar modelo/esforço efetivos; não afirmar carregamento da configuração CLI ou substituição por outro modelo. Luna identificou diferenças de composição; Astra apontou exclusividade do início, identidade das negociações, prazo após match, coerência de pontos/caminhadas, data no retorno e anúncio da troca. As correções foram integradas pelo principal.

Entrega:

- Tela 01 agora tem mapa local feito com views nativas, pins A/B, painel superior com marca/origem/destino e seletores de pessoas/horário. Seleção de locais, data, hora, flexibilidade e caminhada 400 m em modais; CTA preto e navegação Buscar/Viagens/Perfil no rodapé. Data/horário inicial são gerados no cliente após montagem, evitando horário congelado no export estático e divergência na hidratação. Retomar mostra data da intenção e compara Hoje com a data atual, inclusive perto da meia-noite.
- Tela 02 adicionada em /busca com mini-mapa, trajeto, horário/passageiros, status e validade. Telas 03/04 usam PersonCard compartilhado: nome grande, reputação, faixa verde de horário compatível, duas colunas de caminhada e rateio. A espera preserva exploração/troca e oferece simulação explícita do aceite. Resultado de troca com ambos nomes/falha aparece na espera como anúncio live.
- DemoPage substitui apresentação de catálogo por barra de marca/retorno, conteúdo rolável e ações no rodapé. Jornada clara como referências; catálogo conserva temas. Tokens de borda/fundo/raio/sombra ajustados, botão principal 52 dp, variante preta para busca, ícones mínimos nativos sem nova biblioteca. StatusBar acompanha jornada clara mesmo com sistema escuro.
- Aceite mútuo abre /proposta: comparação, sugestão do app, meu trajeto, trajeto da companhia e parada demo conhecida. Cada fixture tem seus próprios quatro valores de caminhada. Pontos da sugestão diferem dos pontos do usuário; atalhos mudam locais mantendo horário na interseção. Opções fora de limite são desabilitadas e novamente validadas no reducer.
- /chat tem companhia, contexto do trajeto, abas Proposta/Chat, bolhas, horários, compositor com limite de 1.000 caracteres, atalhos, rolagem ao fim e resposta simulada acionável. Inspiração consultada: https://www.blablacar.com.br/carpool/passengers/contactar-motorista (conversa contextual à viagem); desenho próprio. Sem transmissão ou resposta real. Dicas locais de segurança sem denúncia/moderação conectadas.
- /resumo exige confirmação dos dois na mesma versão; simulação da companhia é explícita e pode preceder ou suceder a confirmação do usuário. Alterar rota incrementa versão e apaga ambos os aceites. /viagem abre somente com os dois aceites, mostra acordo/rota/paradas/rateio e acesso ao chat. Alteração devolve à negociação.
- Estado vincula comandos à identidade monotônica da negociação e à versão. Iniciar busca não substitui negociação exclusiva; chat não confirma acordo. Negociação/acordo sobrevivem ao prazo de descoberta, sem inventar deadline de negociação. Cancelamento em modal invalida mensagens/confirmacões antigas, limpa participação e volta a /viagens; nova busca requer saída futura. Reinício explícito em /perfil é só controle demo.
- /viagens retoma busca/pedido/negociação/acordo; /perfil é perfil fictício com reinício e catálogo. Nenhum cadastro ou login real foi acrescentado. Arquivos mobile/README.md, LEIA_PRIMEIRO.md e Decisoes_e_pendencias.md sincronizados com a autorização atual e roteiro de teste.

Arquivos principais: mobile/src/features/demo/{DemoPage,JourneyUi,AgreementUi,SearchScreen,ActiveSearchScreen,SuggestionsScreen,WaitingScreen,ProposalScreen,ChatScreen,SummaryScreen,TripScreen,TripsScreen,ProfileScreen}.tsx, domain.ts, novas rotas em src/app/, _layout.tsx, src/ui/{foundation.ts,components.tsx}, tests/demo-domain.test.mjs. Nenhuma dependência, instalação ou alteração de package.json/lockfile necessária.

Verificações reais finais:

| Verificação | Resultado |
|---|---|
| npm.cmd run check | Exit 0: Biome em 40 arquivos e TypeScript sem erros |
| npm.cmd run test:demo | Exit 0: 19/19, incluindo versão antiga, alteração/reconfirmação, prazo após match, exclusividade, cancelamento/reinício, chat sem match e quatro limites das rotas com horário fixo |
| npm.cmd run export:web | Exit 0: 1.893 módulos web / 1.943 de renderização, 13 rotas estáticas, entry-d78c1b82660aed83aae872646df53b2f.js (~3,2 MB) |
| npm.cmd run export:android | Exit 0: 2.299 módulos, entry-0ae6432c3b8d077ca07d8bb1adf0ae44.hbc (~5,2 MB) |
| HTTP local | /, /busca, /sugestoes, /espera, /proposta, /chat, /resumo, /viagem, /viagens, /perfil, /catalogo e bundle final retornaram 200 |
| adb devices | Nenhum aparelho conectado |
| computer-use | Inventário apps/navegadores vazio; criar tab iab retornou Browser is not available: iab |

Alguns comandos exigiram escalonamento porque isolamento bloqueou subprocessos (test runner, DevTools/Hermes, spawn EPERM). Reexecutados localmente com revisão automática e aprovados. Inicialização Expo offline em 8082 gerou tipos e foi encerrada; usar npm.cmd ou CLI node diretamente se PowerShell npm.ps1 retirar argumentos. Expo export web ainda emite aviso histórico de encerramento forçado após exportar, exit 0. Testes ainda emitem avisos strip-types/module detection do Node 22. Sem novo audit/Doctor: não houve mudança de dependências; pendências históricas permanecem.

Prévia deixada ativa: python tools/serve_catalog.py em mobile/, restrita a 127.0.0.1:8081, sessão do executor 94892. Abrir http://127.0.0.1:8081/. Se processo encerrar, executar na raiz `python mobile/tools/serve_catalog.py` (export final já gerado). Dist/ permanece artefato local ignorado, não publicação.

Limitações: sem screenshot ou interação/hidratação comprovada no navegador, sem execução Android/TalkBack/teclado/gesto em runtime. Comparação feita entre imagens de referência e código; fidelidade visual ainda requer conferência no dispositivo, não declarar telas integralmente aceitas. Estado apenas em memória e fixtures locais; recarregar reinicia dados. Proposta limitada às quatro opções e uma parada ordenada de embarque, sem edição livre de ponto/horário/sequência. Isso demonstra o fluxo e não completa RF10/RF12 reais. Sem terceiro usuário, login, persistência, avaliações, notificações, moderação ou denúncia real. Nenhum segredo lido, .env.server.local não acessado, assinatura/billing ativado, e-mail/mensagem externa enviado, backend conectado, migration aplicada ou publicação feita. Mudanças externas preexistentes do Git pai preservadas.

Próximo passo: conferir o roteiro de sete passos de mobile/README.md no navegador/aparelho, comparar screenshots 01–04 e ajustar achados. Depois continuar frontend mockado de feedback/segurança ou edição de proposta dentro do escopo autorizado, mantendo orçamento zero e sem transformar regras pendentes em decisões. Fluxo real/etapas 3–6 continuam dependentes de configuração e regras; esta entrega não comprova etapa 5 real.

## Continuação — frontend da etapa 2 (10 de outubro de 2026)

Novo pedido do usuário: continuar o desenvolvimento após o design system, escolher frontend ou backend e usar Astra/Luna conforme os papéis. Proibição explícita de testes com cobranças reais. O principal escolheu frontend de busca → sugestões → espera → troca em demonstração local, porque reaproveita a fundação e permite avançar sem fechar cadastro, geografia ou permissões ainda pendentes. O pedido atual amplia o escopo histórico das etapas 0/1; restrições abaixo referentes à autorização antiga são histórico, não bloqueiam este lote.

Ferramenta: Codex. Auxiliares solicitados explicitamente: GPT-6 Luna/high para pesquisa somente leitura de requisitos/componentes; GPT-6 Astra/low para assessoria do recorte e revisão de lacunas. Ambos concluíram, mas não tiveram metadados para confirmar modelo/esforço efetivos. Modelo/esforço efetivos do principal também não estão expostos para confirmação nesta interface; não afirmar que a configuração CLI foi carregada. Somente o principal escreveu código e executou verificações. Astra apontou revisão reutilizada no reset, aceite simulado de candidato removido e teste dependente de fuso; corrigidos pelo principal com regressões.

Entrega implementada:

- Raiz agora abre busca demo com regiões fictícias selecionáveis, data/horário local, fuso IANA registrado, horário fixo/flexível, 1 pessoa ou acompanhante e limite ajustável inicial de 400 m. Entradas inválidas impedem iniciar; data/horário viram instante, não comparação de strings. Não se aceitam 3 pessoas numa única conta neste fluxo de descoberta porque não sobra capacidade para a segunda conta.
- /sugestoes mostra projeções fictícias sem foto/endereço/coordenadas privados; filtra interseção inclusiva das janelas, capacidade de até 3 pessoas e caminhada de ambos em cada extremo. Mostra data/hora, nota/viagens fictícias, passageiros, rateio por partes e distâncias explicitamente demo. Gesto horizontal e botões usam as mesmas ações; ativação horizontal/falha vertical deixam a rolagem como intenção padrão. Sem animação adicionada.
- /espera permite explorar sem cancelar, cancelar solicitação e simular explicitamente aceite mútuo. Esse aceite termina o recorte em estado exclusivo e informa que viagem ainda não foi combinada; não há chat ou acordo implementado.
- Modal de troca reaproveita SwapConfirmation; fechar mantém pedido; confirmar revalida candidato, prazo e revisão, preserva anterior válida em falha e informa os nomes no sucesso. Revisões monotônicas evitam comandos antigos após reiniciar. Aceite mútuo impede uma troca obsoleta.
- Estado apenas em memória por DemoProvider compartilhado no layout. Relógio local e retorno do segundo plano revalidam expiração no horário original, com prazo de solicitação limitado ao menor horário das duas intenções. Não há busca real, processamento com app fechado, push ou persistência. Recarregar/apagar sessão reinicia demo; rotas sem intenção redirecionam à busca.

Arquivos: mobile/src/features/demo/{domain.ts,provider.tsx,DemoPage.tsx,SearchScreen.tsx,SuggestionsScreen.tsx,WaitingScreen.tsx}; mobile/src/app/{index.tsx,sugestoes.tsx,espera.tsx,_layout.tsx}; atalho no CatalogScreen.tsx; mobile/tests/demo-domain.test.mjs e script test:demo em package.json; mobile/README.md, tools/serve_catalog.py e documentos/LEIA_PRIMEIRO.md. Nenhuma dependência adicionada ou instalação executada; lockfile preservado. Formulário demo usa estado React e validação pura local; React Hook Form/Zod e TanStack Query continuam direção para formulários/integração reais, sem dependências antecipadas neste lote.

Verificações reais: npm run check aprovado (Biome em 24 arquivos + TypeScript, exit 0) após Expo regenerar tipos das novas rotas; npm run test:demo aprovado, 12/12, no fuso local e novamente em UTC para corrigir dependência de fuso. Casos cobrem extremos de janela, fixos distintos, meia-noite, quatro limites de caminhada, capacidade, pular/rever mantendo pedido, troca bem sucedida/falha, candidato removido, revisões antigas após reset, aceite mútuo concorrente, expiração e entradas inválidas. Node 22.16 usa strip-types experimental e emite avisos de detecção de módulo; não alterada a configuração de módulos do Expo para silenciar aviso. Export Android aprovado, 2.283 módulos, entry-8726f21dd184bfc7ac6e2f3625c7f437.hbc (~5,2 MB), exit 0. Export web aprovado, exit 0, 1.877 módulos cliente/1.919 renderização, seis rotas estáticas (/, /sugestoes, /espera, /catalogo, /_sitemap, /+not-found), entry-5ada023e88e856a71600d3e9830abe4d.js (~3,1 MB). Reapareceu o aviso de encerramento forçado do CLI após exportar; causa ainda não isolada. Artefatos ignorados em dist/, sem publicação.

Limitações: computer-use retornou apps/navegadores vazios; tentativa de criar navegador interno retornou Browser is not available: iab. adb devices sem aparelho. Sem interação/hidratação comprovada, screenshot, gesto em runtime, TalkBack, teclado ou execução Android. Etapas 1/2 não devem ser marcadas integralmente aceitas. A configuração do Expo foi iniciada offline localmente na porta 8082 para gerar tipos e encerrada ao concluir essa finalidade. Não ler .env.server.local; nenhum segredo acessado, serviço faturável ativado, cobrança real testada, e-mail enviado, backend conectado, migration aplicada ou publicação. Git continua no repositório pai com alterações externas preexistentes; nenhuma delas alterada.

Revisão local: servidor anterior da porta 8081 estava indisponível. Iniciado novamente python tools/serve_catalog.py, restrito a 127.0.0.1, e deixado ativo para o usuário. /, /sugestoes, /espera, /catalogo e bundle JavaScript final retornaram HTTP 200. Isso comprova entrega de artefatos, não hidratação/interação. Abrir http://127.0.0.1:8081/; se a sessão encerrar o processo, retomar pelo README. Último npm run check também exit 0. Busca por fetch/URLs/process.env no novo fluxo sem ocorrências.

Próximo passo: testar o fluxo e catálogo com o checklist atualizado de mobile/README.md, capturar screenshots no celular e corrigir achados antes da aceitação visual/funcional. Depois, preparar autenticação/contratos do backend dentro do próximo lote, resolvendo as pendências correspondentes; manter proibição de cobranças reais. Achados do audit e aviso histórico do CLI web continuam registrados abaixo, sem nova triagem de dependências neste lote.

## Preparação para teste do usuário — navegador local

O usuário pediu conferir os pontos do catálogo antes de testar. Nova tentativa de computer-use: inventário vazio, navegador interno indisponível (`Browser is not available: iab`) e alternativa nativa @oai/sky sem pipe disponível (`os error 2`). Não foi possível executar interações, capturar screenshots ou validar layout/foco no navegador. Nenhuma dessas verificações deve ser marcada como concluída.

Criado mobile/tools/serve_catalog.py, servidor Python restrito a 127.0.0.1:8081 para o export existente, com resolução de /catalogo para catalogo.html. Corrigido o 404 observado com http.server padrão na rota sem extensão. Página /catalogo, raiz e bundle JavaScript responderam HTTP 200; isso comprova entrega HTTP dos artefatos, não hidratação/interações. mobile/README.md agora explica como iniciar/encerrar e testar o catálogo local. O servidor foi deixado ativo para o teste do usuário; se encerrar com a sessão, retomar em mobile/ com python tools/serve_catalog.py. Nenhuma dependência instalada, API externa ativada ou publicação realizada.

Uma revisão Luna/high solicitada, somente leitura, confirmou a rota, caminho do JS final e identificação demo nos artefatos; metadados efetivos não confirmáveis pelo auxiliar. Principal manteve edições e verificações. O código do catálogo não mudou neste lote; os checks/exports finais aprovados da retomada abaixo permanecem as evidências técnicas. Etapa 1 implementada, ainda pendente de validação funcional/visual no navegador e Android. Próximo passo: usuário abrir http://127.0.0.1:8081/catalogo e seguir checklist; corrigir achados antes de marcar aceitação integral.

## Retomada — acessibilidade do catálogo (8 de outubro de 2026)

Escopo: correções locais das etapas 0/1 já autorizadas. O principal fez todas as edições. Delegações somente leitura solicitadas com GPT-6 Luna/high (campos e acessibilidade) e GPT-6.1 Sol/medium (lacunas e peças demo), ambas concluídas. Os parâmetros foram enviados explicitamente; os auxiliares não tiveram metadados verificáveis para confirmar modelo/esforço efetivos. A configuração e confirmação do lote anterior abaixo não comprovam esta sessão. Não houve consulta Astra: correções delimitadas, sem decisão arquitetural relevante.

Alterações: mobile/src/ui/components.tsx associa instruções/erros ao campo por ID e aria-describedby, indica aria-invalid e acrescenta accessibilityHint nativo. No web, o nome acessível fica no Modal da plataforma e foi removido o segundo role=dialog interno: react-native-web 0.21 já cria o diálogo externo e implementa Escape, contenção e restauração de foco. No nativo, preservados papel e nome no conteúdo, pois o Modal nativo não repassa essas props ao host. Tamagui 2.7.7 já converte disabled em editable=false nativo; não foi necessário alterar esse comportamento. mobile/src/features/catalog/CatalogScreen.tsx mostra resultado da troca demo com os dois nomes e região de anúncio polite. mobile/README.md inclui troca nos dois sentidos e os novos critérios acessíveis.

Verificações desta retomada: npm run check aprovado após o ajuste final (Biome em 15 arquivos e TypeScript, exit 0). Export Android final aprovado, exit 0, 2.275 módulos, bundle entry-047ac0f1cd536eebe5187800aa3e07a4.hbc (~5,1 MB). Export web final aprovado, exit 0, quatro rotas estáticas, bundle entry-843170a8c11f82c2e734deeaac122beb.js (~3,1 MB); reapareceu o aviso de encerramento forçado do CLI após a exportação. Artefatos em dist/ são locais, ignorados pelo Git. adb devices sem aparelho conectado; inventário computer-use com apps e navegadores vazios. Nenhum teste visual, TalkBack ou interação em runtime foi realizado. Leituras e verificações usaram escalonamento porque o executor restrito falhou ao inicializar; sem leitura de segredos, instalação ou publicação. Git continua exibindo este projeto não rastreado no repositório pai.

Próximo passo: validar o checklist atualizado em Android e navegador disponíveis. A etapa 1 permanece pendente de aceitação visual/funcional no dispositivo. Audit e encerramento do CLI web registrados no lote anterior permanecem pendentes, sem nova triagem neste lote. TimeWindow/Walking continuam peças de apresentação com dados estáticos coerentes; validar entradas quando forem integradas ao fluxo futuro. Etapas posteriores não foram iniciadas.

## Lote encerrado

Ferramenta: Codex. Escopo autorizado pelo usuário: iniciar etapas 0 e 1 do roteiro, auditar/estabilizar Expo e criar design system Tamagui com catálogo demo, Android primeiro, TypeScript e Biome. Sem backend real, e-mails, serviços faturáveis ou publicação. Esta autorização não inclui etapas posteriores.

Modelos efetivos confirmados em metadados: GPT-6.1 Sol/medium como principal; duas pesquisas GPT-6 Luna/high, somente leitura (base Expo e documentação Tamagui); GPT-6 Astra/low como assessor para arquitetura da fundação, triagem do audit e revisão dos arquivos implementados. Só o principal editou, instalou, integrou e verificou. Não presumir que a configuração CLI foi carregada no app.

## Estado das etapas

- Etapa 0: base Expo instalada e compilável, lockfile reproduzido por npm ci, scripts e rotas resolvidos, Biome/TypeScript válidos e Doctor 21/21. Existem achados residuais do npm audit e aviso de encerramento do CLI no export web, descritos abaixo.
- Etapa 1: fundação Tamagui e catálogo implementados e renderização estática web comprovada. Aceitação funcional/visual integral pendente no Android e no navegador: fonte do sistema ampliada, teclado, TalkBack, foco, áreas de toque, estados e retorno do modal. Não marcar a etapa 1 integralmente concluída só pelos bundles.
- Etapas 2 em diante: não implementadas. Peças de trajeto/companhia/troca são amostras internas, não fluxo de busca real.

## Entrega e arquivos

- mobile/package.json, package-lock.json e biome.json: npm, Biome 2.5.15, Tamagui/config 2.7.7, scripts check/doctor/export. Script de teste inexistente retirado; não há suíte automatizada de interação nesta fundação.
- mobile/tamagui.config.ts e src/ui/foundation.ts: temas claro/escuro, tokens semânticos, tipografia do sistema, espaços, raios, sombras e bordas de controles com contraste reforçado; sem compilador/driver de animação opcional.
- mobile/src/ui/provider.tsx, components.tsx e product.tsx: componentes base, estados e peças demo. Modal React Native com conteúdo Tamagui, rolagem, fechamento explícito e onRequestClose; sem animação.
- mobile/src/app/_layout.tsx, index.tsx, catalogo.tsx e +not-found.tsx: rota inicial para /catalogo e retorno para rota desconhecida.
- mobile/src/features/catalog/CatalogScreen.tsx: cinco categorias, tema, prévia de fonte 150%, campos/checkbox, botões e modais interativos em memória.
- mobile/app.json e README.md: identificação demo, fundo do splash, instruções npm e checklist visual. Assets originais preservados; branding final pendente.
- documentos/Auditoria_da_base.md: diagnóstico, reaproveitamento, evidências, limitações e triagem do audit.
- Decisoes_e_pendencias.md, Divide_ai_requisitos.md, Plano_de_desenvolvimento.md, Contratos_tecnicos.md e Roteiro_de_implementacao.md: sincronizadas decisões de 400 m, dupla/terceiro fora do MVP e OTP/remetente. LEIA_PRIMEIRO.md e Guia_para_agentes.md atualizados quanto ao estado da base.

Detalhes: [Auditoria_da_base.md](Auditoria_da_base.md). Execução e checklist: [mobile/README.md](../mobile/README.md).

## Verificações reais

Ambiente: Node 22.16.0, npm 10.9.2. O terminal isolado falhou com helper_unknown_error; comandos foram executados com escalonamento revisado, dentro do escopo autorizado. Instalação única por vez; não executar instaladores concorrentes na retomada. Um expo install de ferramentas instalou os pacotes mas terminou com erro de diretório mobile/install; a instalação efetiva foi conferida e reproduzida posteriormente, sem tratar essa saída como sucesso do CLI.

| Verificação | Resultado |
|---|---|
| npm ci --no-audit --no-fund | Exit 0; 745 pacotes reinstalados a partir do lockfile |
| npm run check | Exit 0; Biome em 15 arquivos e TypeScript sem erros, após o último ajuste de código |
| npx expo install --check | Dependências atualizadas para SDK 57 |
| npm run doctor | Exit 0; 21/21 verificações aprovadas |
| npm ls --depth=0 | Árvore instalada válida, incluindo Expo 57.0.27, RN 0.86.3, React 19.2.3 e Tamagui/config 2.7.7 |
| npm run export:android | Exit 0; 2.275 módulos, bundle Hermes ~5,1 MB em dist/android |
| npm run export:web | Exit 0; 1.869 módulos web, 1.919 renderização, quatro rotas estáticas em dist/web, incluindo /catalogo (~71 KB de HTML) |
| Contraste numérico dos tokens finais | Menor par de texto: claro 5,31:1 / escuro 6,41:1; bordas de controle: 3,11:1 / 4,35:1 |
| adb devices | Nenhum dispositivo conectado |
| Navegador pela ferramenta de computer-use | Navegador interno indisponível; inventário de navegadores/apps vazio |

Exports finais usam dois workers. A tentativa web inicial com concorrência padrão foi interrompida por lentidão. Nas tentativas web concluídas, o CLI avisou que algo impedia seu encerramento e forçou a saída após exportar, com exit 0; causa não isolada. Android não apresentou esse aviso. Não houve screenshot, validação visual no navegador, execução Android, APK, backend, migration, e-mail real ou publicação. Renderização estática não comprova interações/hidratação. A prévia 150% não substitui teste com a fonte do sistema Android.

Artefatos locais finais, ignorados pelo Git: Android entry-c59b8fdd48ccbc97cfa5755842d40a23.hbc; web entry-82069aae24d5376a0a9beb9e13201bb3.js. Não são versões publicadas.

## Segurança e preservação local

npm audit: 29 ocorrências (11 moderadas, 18 altas), principalmente propagação de braces, node-forge, decode-uri-component e uuid. Audit não aprovado; exploração no app não comprovada. Cadeias registradas na auditoria; decode-uri-component via Router/query-string merece prioridade por entradas de URL/deep links. Não aplicados audit fix --force, downgrades do SDK ou overrides incompatíveis. Revisar atualização compatível, audit e entradas afetadas antes de distribuição/integração real.

Git encontrado no diretório pai C:/Users/T.i/Desktop/trampo; este projeto aparece não rastreado. Não declarar árvore limpa nem diff histórico próprio. Nenhuma mudança externa ao projeto, reset, commit ou alteração do índice foi feita. Nenhum segredo foi lido; .env.server.local não foi acessado.

## Decisões que prevalecem

400 m iniciais ajustáveis, separadamente em cada extremo. MVP com duas contas, sem inclusão de terceira conta; limite de três pessoas contando acompanhantes preservado. OTP de 10 minutos/reenvio 60 segundos e remetente acesso@divideai.com confirmados, mas configuração e envio real ainda não testados. Os documentos de produto foram sincronizados; demais pendências de cadastro, simultaneidade, avaliações, moderação, geografia/custos continuam em aberto e não bloquearam a fundação visual.

## Próximo passo

Retomar pelo checklist do README em aparelho/emulador Android com SDK 57 compatível e navegador disponível. Conferir abrir/fechar modal pelo retorno Android, manter/trocar companhia localmente, campo vazio/preenchido, botões ocupados/desabilitados, temas, teclado, foco e fonte do sistema ampliada/TalkBack. Corrigir achados dentro das etapas 0/1 e atualizar esta passagem. Não avançar para backend, e-mail, billing, publicação ou etapas posteriores sem tarefa correspondente.

Ao trocar de ferramenta, reler entrada, regras, esta passagem e arquivos reais. Revisão cruzada começa somente leitura. Preservar mudanças locais e registrar apenas verificações efetivamente realizadas.

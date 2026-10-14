# Divide aí — integração com o backend e com serviços externos

Atualizado em 12 de outubro de 2026. Descreve a camada que prepara o app para sair da demonstração: configuração por `.env`, adaptadores de autenticação/dados/endereços/mapa e o contrato HTTP esperado do backend. Os nomes de tabelas e funções continuam propostas em [Contratos_tecnicos.md](Contratos_tecnicos.md); este documento fixa **o que o app envia e espera**, para o backend ser construído (ou adaptado) em cima disso.

**Backend real (Supabase):** `supabase/migrations/20261012000000_core.sql` implementa este contrato em PostgreSQL (funções `public.app_*` chamadas como RPC do PostgREST; tabelas fechadas por RLS sem política). Para usar: aplicar a migration num projeto Supabase de teste, copiar `mobile/.env.supabase.example` para `mobile/.env` e preencher URL e chave pública. As leituras (`STATE_GET` etc.) são **POST** no PostgREST, porque avançam prazos e entregam avisos (o arquivo de exemplo já configura isso). Testes: `supabase/tests` (ver "Testes do banco" abaixo). **Ainda não aplicado a um Supabase de verdade** (ver "O que ainda falta").

**Estado:** a camada está implementada e testada contra um backend **falso** (`mobile/tools/mock_backend.mjs`), não contra um servidor real. Nenhuma chamada a Supabase, Resend ou outro serviço pago foi feita. Sem `.env` preenchido o app se comporta exatamente como a demonstração anterior.

## Como ligar

1. `cd mobile` e copie `.env.example` para `.env` (já existe um `.env` local, ignorado pelo Git, com tudo vazio).
2. Preencha `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_API_KEY` (chave **pública**) e os endpoints da tabela abaixo. Troque `EXPO_PUBLIC_DATA_SOURCE` para `api`.
3. Para o login real, `EXPO_PUBLIC_AUTH_PROVIDER=supabase` (ver "Autenticação e e-mail").
4. Reinicie o Expo com cache limpo (`npx expo start -c`) ou exporte de novo: `npm run export:web` já usa `--clear`. **Sem limpar o cache o Metro pode manter valores antigos do `.env`** (aconteceu nos testes).
5. Valores inválidos nunca derrubam o app: ele volta ao padrão seguro e lista o motivo no console de desenvolvimento (`[divide-ai] configuração`). `api` sem URL válida mantém a demonstração.

Tudo com prefixo `EXPO_PUBLIC_` é empacotado no app e **visível a qualquer pessoa**. Segredos (Resend, `service_role`, chaves faturáveis) ficam só no servidor: veja `../.env.server.example`.

No Windows com Git Bash, `export VAR=/caminho` vira `C:/Program Files/Git/caminho` ao chamar o Expo. Use `.env`, PowerShell ou `MSYS_NO_PATHCONV=1`. O app recusa esse valor e avisa no console.

## Variáveis (`mobile/.env.example`)

| Variável | Para quê | Padrão |
|---|---|---|
| `EXPO_PUBLIC_DATA_SOURCE` | `demo` (dados fictícios em memória) ou `api` (backend) | `demo` |
| `EXPO_PUBLIC_API_BASE_URL` | Base do backend, https (http só em localhost, 10.0.2.2 e rede local) | vazio |
| `EXPO_PUBLIC_API_KEY` | Chave **pública**, enviada em `apikey` (no Supabase, a anon/publishable) | vazio |
| `EXPO_PUBLIC_API_TIMEOUT_MS` | Tempo máximo por chamada, 1000–120000 | 15000 |
| `EXPO_PUBLIC_API_POLL_MS` | Intervalo da atualização automática do estado; 0 desliga | 5000 |
| `EXPO_PUBLIC_API_<NOME>` | Endpoints (tabela adiante). `"/caminho"`, `"MÉTODO /caminho"` ou URL https | vazio |
| `EXPO_PUBLIC_AUTH_PROVIDER` | `demo` (código 123456) ou `supabase` | `demo` |
| `EXPO_PUBLIC_AUTH_BASE_URL` | URL do Auth, se diferente da base da API | = base da API |
| `EXPO_PUBLIC_GEOCODER_PROVIDER` | `photon` (público) ou `api` (seu backend) | `photon` |
| `EXPO_PUBLIC_GEOCODER_URL` | Base do Photon (ou do backend, no modo `api`) | `https://photon.komoot.io` |
| `EXPO_PUBLIC_GEOCODER_SEARCH` / `_REVERSE` | Rotas GET do modo `api` | vazio |
| `EXPO_PUBLIC_GEOCODER_INTERVAL_MS` | Intervalo mínimo entre consultas | 1200 (Photon), 0 (api) |
| `EXPO_PUBLIC_MAP_TILE_URL` | Modelo Leaflet `{z}/{x}/{y}` (https), `{s}` e `{r}` opcionais | OpenStreetMap |
| `EXPO_PUBLIC_MAP_TILE_MAX_ZOOM` | Zoom máximo do provedor | 19 |
| `EXPO_PUBLIC_MAP_ATTRIBUTION_TEXT` / `_URL` | Crédito exigido pelo provedor dos tiles | OpenStreetMap |

Cada endpoint aceita `"/caminho"` (método padrão: GET para os de leitura, POST para os de escrita), `"POST /rest/v1/rpc/funcao"` (método explícito, útil para RPC do Supabase) ou uma URL https completa.

## Mapa do código

| Arquivo | Responsabilidade |
|---|---|
| `src/services/env.ts` | Única leitura de `process.env` (o Expo só troca acessos literais) |
| `src/services/config.ts` | Valida o ambiente e produz `config`; nunca lança erro |
| `src/services/http.ts` | Cliente HTTP: JSON, timeout, `apikey`/`Authorization`, `Idempotency-Key`, uma nova tentativa só quando seguro, erros em português |
| `src/services/auth.ts` | `AuthAdapter` (`demo`, `supabase` por REST, sem SDK), `SessionStore` e gerenciador de sessão com renovação |
| `src/services/gateway.ts` | Comando do app → rota/corpo, validação estrita do snapshot, leitura do estado |
| `src/services/index.ts` | Monta tudo (`services`); `createServices(config, { fetcher, store })` para testes |
| `src/features/demo/provider.tsx` | Escolhe o caminho: reducer local (demo) ou gateway (api), fila de comandos, atualização periódica |
| `src/features/maps/{geocoder,tiles,html}.ts` | Geocoder e tiles configuráveis |
| `tools/mock_backend.mjs`, `.env.mock.example`, `tools/e2e_api_smoke.mjs` | Backend falso, configuração para usá-lo e teste de fumaça no navegador |

Na demonstração nada muda: os mesmos comandos passam pelo reducer. No modo `api`, comandos de **interface** (`tick`, `skip`, `review`, `reset`, `verify-email`, `sign-out`) continuam locais; os que **simulam a outra pessoa ou o relógio** (`simulate-match`, `unavailable`, `simulate-their-review`, `end-trip`, escolha/mensagem "da outra pessoa") deixam de existir (controles `Demo` somem, selo DEMO some); o restante vai ao servidor. `send(command, depois)` só executa `depois` (navegação, limpar rascunho) quando o servidor confirmou. Falhas aparecem numa faixa vermelha ("Não foi possível concluir") que some em 8 s.

## Contrato HTTP

Cabeçalhos em toda chamada: `Accept: application/json`, `apikey: <chave pública>`, `Authorization: Bearer <token da sessão>` (após o login) e, nas escritas, `Content-Type: application/json` e `Idempotency-Key: <uuid>`. Em navegador, o servidor precisa liberar esses cabeçalhos em CORS (`apikey, authorization, content-type, idempotency-key`).

**Princípios.** O servidor decide e valida tudo (compatibilidade, capacidade, validade, bloqueios, exclusividade). Toda escrita devolve **o estado atualizado** (snapshot, completo ou parcial). Instantes trafegam em ISO-8601 UTC (`2026-10-12T21:00:00Z`; milissegundos também são aceitos) com o fuso IANA em `timeZone`. A mesma `Idempotency-Key` repetida pelo mesmo usuário deve devolver o mesmo resultado sem duplicar pedido, mensagem ou aviso. O app repete **uma vez** uma escrita que falhou por rede/tempo esgotado, com a mesma chave.

### Leitura

| Variável | Método padrão | Resposta |
|---|---|---|
| `API_STATE_GET` | GET | Snapshot completo (carregado ao entrar e a cada `POLL_MS`) |
| `API_CANDIDATES_GET` | GET | `{ "candidates": [...] }` |
| `API_MESSAGES_GET` | GET `?negotiation=<n>` | `{ "messages": [...] }` |
| `API_HISTORY_GET` | GET | `{ "history": [...] }` |

As três últimas são opcionais: sem elas o app usa `API_STATE_GET`. Em método diferente de GET os parâmetros vão no corpo (`{ "resource": "messages", "negotiation": 9 }`).

### Escrita (todas POST por padrão; corpo → snapshot)

| Variável | Corpo enviado | Comando do app |
|---|---|---|
| `API_PROFILE_SAVE` | `{ profile: { email, name, phone, birth, photo } }` | cadastro |
| `API_INTENT_SAVE` | `{ intent: { departure, timeZone, fixed, passengers, walkingLimit, origin, destination, points? } }` | iniciar busca (candidatos vêm na resposta) |
| `API_REQUEST_SEND` | `{ candidateId, expectedRevision }` | pedir companhia / trocar o pedido pendente |
| `API_INTENT_CANCEL` | `{}` | cancelar a busca ativa (e o pedido pendente); com negociação em andamento não faz nada e avisa |
| `API_REQUEST_CANCEL` | `{}` | cancelar o pedido pendente |
| `API_REQUEST_DECLINE` | `{ candidateId }` | recusar o pedido recebido de `candidateId`; o snapshot traz `incoming` (quem pediu a mim). `API_REQUEST_SEND` aceita `declineIncoming: true` para recusar quem pediu antes de aceitar outra pessoa |
| `API_PROPOSAL_PICK` | `{ negotiation, expectedVersion, choice, stop? }` | escolher uma opção da proposta |
| `API_MESSAGE_SEND` | `{ negotiation, text }` | mensagem do chat |
| `API_NEGOTIATION_END` | `{ negotiation }` | cancelar a participação |
| `API_TRIP_OUTCOME` | `{ negotiation, happened, reason? }` | a viagem aconteceu ou não |
| `API_REVIEW_SEND` | `{ negotiation, stars, comment }` | avaliação |
| `API_TRIP_CLOSE` | `{ negotiation }` | concluir e arquivar |
| `API_REPORT_SEND` | `{ companionId, reason, details }` | denúncia |
| `API_BLOCK_ADD` / `API_BLOCK_REMOVE` | `{ companionId }` | bloquear / desbloquear |

`choice` ∈ `suggestion | mine | theirs | stop`; `reason` de viagem não realizada ∈ `no-show | could-not-go | agreed-cancel | no-car | other`; `reason` de denúncia ∈ `behavior | unsafe | fake | payment | other`. O texto de avaliação/denúncia chega aparado; as regras (mínimo 3 estrelas sem texto, 500/1000 caracteres) devem ser repetidas no servidor.

### Snapshot (resposta)

Objeto JSON com qualquer subconjunto destas chaves; só as presentes substituem o estado do aparelho, chaves desconhecidas são ignoradas e qualquer valor fora do formato rejeita a resposta inteira (erro "Resposta inesperada do servidor"). Formatos exatos: tipos `Intent`, `Candidate`, `Proposal`, `ChatMessage`, `PostTrip`, `TripRecord`, `Report`, `Profile` em `src/features/demo/domain.ts` e validadores em `src/services/gateway.ts`.

| Chave | Conteúdo |
|---|---|
| `profile` | perfil ou `null` |
| `intent` | busca atual ou `null` |
| `candidates` | projeção de descoberta: **sem endereço exato, coordenadas, foto ou dados pessoais** antes do aceite mútuo |
| `skipped`, `blocked` | ids de candidatos |
| `pending`, `matched` | id do candidato com pedido pendente / com aceite mútuo, ou `null` |
| `revision` | inteiro; o app o devolve em `expectedRevision` |
| `proposal` | versão atual da proposta (`version`, `picks.mine/theirs`, pontos, paradas, caminhadas) ou `null`; o acordo é derivado quando as duas escolhas coincidem |
| `messages` | chat da negociação |
| `postTrip`, `history` | ciclo depois da viagem e viagens concluídas |
| `reports` | denúncias do usuário |
| `message` | aviso curto opcional (ex.: "A solicitação venceu") |

### Erros

| HTTP | O que o app faz |
|---|---|
| 401 | Tenta renovar a sessão uma vez e repetir; se falhar, volta ao login |
| 409 | Aviso "Algo mudou…" e recarrega o estado (versão/revisão velha; nunca aplicar uma confirmação antiga) |
| 400/422 | "Confira os dados e tente novamente" |
| 403, 404, 429 | Avisos próprios (permissão, não encontrado, muitas tentativas) |
| 5xx | "O servidor está indisponível" |
| rede/tempo | "Sem conexão com o servidor" / "O servidor demorou a responder" |

Mensagens do servidor **não são exibidas**: só o status define o texto, para nunca vazar detalhe técnico na tela.

## Autenticação e e-mail

O e-mail com o código **é disparado pelo servidor**, nunca pelo app. Pelas decisões do projeto, o Supabase Auth gera e valida o código e entrega por SMTP do Resend. Por isso a chave do Resend (`RESEND_API_KEY`) não existe no app. O adaptador do app só pede o envio e confere o código.

- `demo`: nenhum e-mail; código fixo 123456 (comportamento anterior).
- `supabase`: REST do GoTrue, sem SDK. `POST {url}/auth/v1/otp` (`create_user: true`), `POST /auth/v1/verify` (`type: "email"`), `POST /auth/v1/token?grant_type=refresh_token` e `POST /auth/v1/logout`, com `apikey` público. Configuração no painel: SMTP do Resend (host `smtp.resend.com`, porta 465, usuário `resend`, senha = chave), remetente `Divide aí <acesso@divideai.com>`, modelo do e-mail com `{{ .Token }}`, OTP de **6 dígitos**, validade 10 min; reenvio após 60 s é imposto pelo app e deve ser pelo servidor. Domínio e DNS ainda não verificados.
- A sessão fica **em memória**: recarregar o app pede o login de novo. Para manter o login no aparelho, implemente `SessionStore` (`load/save/clear`) com `expo-secure-store` (`npx expo install expo-secure-store`) e passe-o a `createServices`. Não usar `localStorage` para tokens.
- Perfil de quem já tem cadastro: depois do código o app lê `API_STATE_GET`; se `profile` vier preenchido, vai direto ao início, senão ao cadastro.

Para outro provedor de e-mail/login, basta implementar `AuthAdapter` (`requestCode`, `verifyCode`, `refresh`, `signOut`) em `auth.ts` e escolhê-lo em `createAuth`.

## Busca de endereços

- `photon` (padrão): Photon público, sem chave, ritmo de 1 consulta a cada 1,2 s, só para demonstração (sem SLA). `GEOCODER_URL` aponta para um Photon próprio.
- `api`: seu backend como proxy de qualquer provedor (Google Places, Mapbox…), com chave e cota guardadas no servidor. O app envia o token da sessão e a chave pública.
  - `GET {GEOCODER_SEARCH}?q=<texto>&limit=5`
  - `GET {GEOCODER_REVERSE}?lat=<lat>&lon=<lon>&limit=1`
  - resposta: `{ "places": [{ "title", "detail"?, "street"?, "area"?, "latitude", "longitude", "id"? }] }` (até 5; coordenadas inválidas são descartadas).

## Mapa

O app carrega tiles pelo modelo configurado; a política de segurança do mapa só aceita imagens do host desse modelo (curinga para `{s}`). O OpenStreetMap padrão serve a demonstração e uso leve ([política de tiles](https://operations.osmfoundation.org/policies/tiles/)); para produção contrate um provedor, informe `MAP_TILE_URL` e o crédito em `MAP_ATTRIBUTION_*`. Chaves de tiles na URL são públicas por natureza: restrinja-as por domínio/pacote no painel do provedor.

## Backend falso e verificações

- `node --experimental-strip-types tools/mock_backend.mjs` (porta 8787) implementa este contrato com a regra do app por trás: o aceite da outra pessoa chega 3 s depois do pedido, ela escolhe a mesma opção que você, a viagem "termina" 15 s depois do acordo. Aplica `Idempotency-Key`, devolve 401/409 e simula o Supabase Auth (código 123456). Nenhum e-mail é enviado.
- `.env.mock.example` aponta o app para ele. `node tools/e2e_api_smoke.mjs` sobe o mock e percorre login, cadastro, endereços, pedido, aceite por atualização automática, chat, acordo e queda de rede num navegador.
- `npm test` roda os testes de unidade (demo, mapas, endereços e `tests/services.test.mjs`, que inclui a conferência de que `.env.example` lista exatamente as variáveis lidas pelo app).

## Backend em SQL: regras, decisões provisórias e testes

- **Regras no servidor:** janela ±15 min (inclusiva) ou instante fixo; capacidade 3 contando acompanhantes; limite de caminhada por pessoa; expiração no menor horário original validada a cada operação (pedido e negociação sem acordo vencem sozinhos na leitura, sem depender de tarefa agendada); uma solicitação pendente por pessoa; aceite mútuo cria negociação exclusiva (índice único); versão da proposta (conflito → 409); acordo derivado das duas escolhas iguais; avaliação só aparece depois de a pessoa avaliar (antes vai um marcador `stars: 0` sem conteúdo); idempotência por `Idempotency-Key` (mesma chave+mesmo corpo → mesma resposta; outro corpo → 422); 429 após 20 buscas/hora.
- **Confirmado pelo idealizador (13/10/2026):** a distância de caminhada é o **percurso a pé calculado no mapa**, não linha reta; o fim da viagem é **1 h depois do horário combinado**; depois do aceite mútuo o **endereço da outra pessoa aparece** quando se escolhe o ponto dela; **quem nunca avalia também recebe nota** (só não vê as avaliações enquanto não avaliar).
- **Percurso a pé:** o SQL não chama provedor. Ao salvar a busca, os pares plausíveis (linha reta só como filtro: se já passa da soma dos limites, o percurso também passaria) entram em `route_queue`; o worker `supabase/worker/routes.mjs` (servidor, chave `service_role`, adaptadores OSRM e openrouteservice) consulta o provedor e grava `walk_routes` (metros e ponto no meio do percurso, que é a sugestão de encontro). **Sem rota calculada o par não aparece nas sugestões** (nunca se converte estimativa em distância). O app já atualiza a cada 5 s, então a pessoa vê as sugestões quando as rotas chegam. Rodar o worker em intervalo curto (cron/loop a cada poucos segundos) enquanto houver fila. Falhas são contadas (5 tentativas).
- **Ainda provisório:** qual provedor de rotas usar em produção (quotas, termos de cache, teto monetário; para teste, OSRM próprio com perfil foot é gratuito); busca sem pontos no mapa não aparece na descoberta; distâncias da descoberta saem em faixas de 100 m para não permitir trilateração; a escolha "parada" devolve 422 até haver pontos reais; denunciar/bloquear só quem já esteve numa negociação com a pessoa.
- **Testes do banco** (`supabase/tests`, 26 casos, 3 deles do worker sem banco): usam PGlite (PostgreSQL em WebAssembly), sem Docker nem conta. PGlite não é dependência do projeto: `mkdir ../pg && cd ../pg && npm i @electric-sql/pglite`, depois `PGLITE_DIR=<pasta> npm run test:backend` (em `mobile/`). Sem `PGLITE_DIR` os testes são pulados. `contract.test.mjs` passa as respostas reais do SQL pelo `readSnapshot` do app.
- **Não coberto:** concorrência real (PGlite tem uma conexão), PostgREST de verdade (corpo inteiro no `jsonb` sem nome, `PTnnn`→HTTP), privilégios padrão do Supabase (a migration revoga de `anon`/`authenticated`, mas confira no projeto real), e `rolbypassrls` do dono das funções.

## O que ainda falta (não declarar pronto)

- **Nada foi validado contra Supabase/Resend/Google reais.** O adaptador Supabase segue a API REST documentada do GoTrue, mas só foi exercitado com respostas simuladas.
- Contrato de dados é proposta do app; o servidor pode mapear o seu esquema para ele (RPC/Edge Function) ou o `gateway.ts` pode ser ajustado — é o único lugar com rotas e corpos.
- Sem Realtime/push: o estado atualiza por consulta periódica. Notificações (lembrete pós-viagem, aceite) dependem de `device_tokens` e de entrega no servidor.
- Foto de perfil é só um marcador (`photo: boolean`); falta upload para armazenamento privado.
- Persistência da sessão no aparelho (SecureStore) e logout em todos os dispositivos.
- Telas ainda assumem que `candidates`, `proposal` etc. chegam no snapshot; pontos exatos de caminhada/rotas reais ainda são dados do servidor (hoje, fixtures do domínio demo).
- Limites de tentativa do OTP, quotas por usuário e teto monetário dos serviços faturáveis.
- Testes de RLS, concorrência e idempotência do banco (ver `Roteiro_de_implementacao.md`, etapa 4).

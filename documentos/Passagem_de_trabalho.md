# Divide aí — passagem de trabalho

Atualizado em 11 de outubro de 2026.

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

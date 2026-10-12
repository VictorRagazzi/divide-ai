# Divide aí — app demo

Base Expo SDK 57, React Native 0.86.3, React 19.2.3, TypeScript, Tamagui 2.7.7 (preset v5) e Biome. Android primeiro. MVP com mapa real OpenStreetMap e busca, sugestões, espera, troca, comparação, chat, resumo e cancelamento simulados. Coordenadas e estado ficam em memória; sem backend, e-mail, pagamento ou assinatura.

## Experimentar o fluxo principal

1. Abra http://127.0.0.1:8081/ com o servidor local iniciado conforme abaixo. Preencha os dois campos empilhados **Local de partida** e **Para onde?** com rua, número ou bairro, incluindo a cidade para distinguir locais, e selecione uma sugestão. Os campos começam vazios; o mapa abre no centro de Belo Horizonte apenas como região inicial. **Minha localização** solicita GPS somente naquele momento. **Escolher no mapa** permite tocar ou arrastar o pin do campo selecionado; a identificação da rua é automática quando disponível. Não há formulário de latitude/longitude. Editar um endereço exige selecionar novamente uma sugestão ou ponto antes de **Buscar companhia**. **Opções** expande pessoas/horário e **Mapa** recolhe o painel. O horário inicial é uma hora à frente ao abrir o app.
2. Toque em **Buscar companhia**, depois **Ver sugestões**. Aceite Evandro. A tela de espera mantém a solicitação enquanto você explora outras sugestões; aceitar Bruno pede confirmação de troca.
3. Na espera, toque em **Demo: simular aceite da companhia**. O aceite mútuo abre **Vamos combinar?**, com comparação e quatro opções de trajeto. Escolher uma opção não confirma a viagem.
4. Abra a aba **Chat**, envie mensagens ou use os atalhos. **Demo: simular resposta da companhia** acrescenta uma resposta fictícia. Volte ao resumo para conferir os detalhes.
5. Toque em **Conferir resumo**, **Confirmar esta proposta** e **Demo: simular confirmação** da companhia. A ordem dos dois aceites pode ser invertida. Só ambos na mesma versão abrem **Viagem combinada**.
6. Em **Alterar detalhes da viagem**, selecione outra opção. As duas confirmações são apagadas e o resumo passa à versão seguinte. Confirme novamente para testar.
7. **Cancelar minha participação** abre confirmação; continuar preserva a negociação e cancelar encerra os dados daquela participação. **Viagens** permite retomar busca, negociação ou acordo; **Perfil** permite reiniciar a demonstração e acessar o catálogo. A barra **Buscar / Viagens / Perfil** permanece no rodapé das três telas principais, indica a aba selecionada e permite alternar sem seta de voltar.

As quatro primeiras telas seguem a composição das referências em ../telas/: mapa com painel na busca; cabeçalho com marca/retorno; cartões claros, faixa de horário e caminhadas lado a lado; ações no rodapé. As demais reaproveitam esses padrões. O chat adota conversa em bolhas, companhia e contexto do trajeto, inspirado no [fluxo de conversa da BlaBlaCar](https://www.blablacar.com.br/carpool/passengers/contactar-motorista), com layout próprio do Divide aí.

Limites desta entrega: recarregar reinicia os dados; respostas e confirmações da companhia exigem os controles demo. A seleção de pontos e a busca de endereços são reais, mas os quatro trajetos da negociação, parada e valores de caminhada são fixtures; não há rota calculada nem compatibilidade geográfica real. Não implementa login real, terceira conta, notificações, avaliações, moderação ou denúncias conectadas. Não há contratação de serviços. Compilação e testes não comprovam fidelidade visual ou interação no Android.

## Mapa sem orçamento

Leaflet 1.9.4 está empacotado localmente com licença BSD; sem JavaScript de CDN. No Android/iOS, usa react-native-webview 13.16.1; no web, iframe com documento local. WebView e expo-location ~57.0.20 são incluídos no Expo Go do SDK 57, conforme [WebView](https://docs.expo.dev/versions/v57.0.0/sdk/webview/) e [Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/). MapLibre nativo exige development build e permanece alternativa futura; a solução atual prioriza teste do MVP sem conta/chave/billing. Gestos e acessibilidade precisam ser conferidos no aparelho.

Tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png, crédito visível **© OpenStreetMap contributors**, cache HTTP padrão habilitado, User-Agent nativo identificado e Referer padrão do navegador. Só carrega a região visível, sem prefetch ou download offline. É serviço comunitário sem SLA, adequado a teste moderado; uso amplo exige reavaliar fornecedor/capacidade pela [política oficial de tiles](https://operations.osmfoundation.org/policies/tiles/). O fornecedor recebe IP e região visualizada. GPS fica na sessão e não acompanha a pessoa em segundo plano.

Os campos seguem o padrão de partida/destino da [Uber](https://www.uber.com/br/pt-br/ride/), adaptado ao design do Divide aí. Busca textual e identificação do ponto usam o servidor público de demonstração [Photon](https://github.com/komoot/photon#demo-server), com dados OpenStreetMap, sem conta, chave ou billing. Esse servidor permite uso moderado, sem SLA ou quota numérica garantida; pode restringir acesso. A cobertura de ruas, números e bairros varia. O cliente espera 900 ms de digitação, exige três caracteres, serializa consultas com intervalo de 1,2 s, limita resultados a cinco e mantém cache de sessão por 15 minutos; esses limites são escolhas locais, não quotas oficiais. Cancela consultas obsoletas e não faz retries automáticos. Usa `lang=default`, pois `lang=pt` foi rejeitado pelo servidor consultado. O serviço recebe IP, texto pesquisado e pontos usados na identificação reversa, inclusive GPS escolhido explicitamente. Não há persistência desses dados pelo app.

Nominatim público não foi integrado; sua [política](https://operations.osmfoundation.org/policies/nominatim/) proíbe autocomplete. Sem resposta do Photon, é possível escolher no mapa com rótulo genérico, preservando o ponto exato; uma referência próxima não substitui a posição selecionada. Nenhuma linha reta é apresentada como rota viária.

Após atualizar Leaflet, execute `npm run vendor:maps` para regenerar JS/CSS/licença em src/features/maps/generated/. Os assets gerados ficam versionados para builds reproduzíveis e não são formatados pelo Biome. A licença também acompanha o documento do mapa.

## Executar

Requer Node >=22.13 (validado com 22.16.0) e npm (validado com 10.9.2). Em mobile/:

```powershell
npm ci
npm run android
```

Abra em um Android com ambiente Expo compatível com o SDK 57. Emulador/aparelho precisa estar disponível. A raiz abre a busca demo; /busca, /sugestoes e /espera exigem intenção; /proposta, /chat, /resumo e /viagem exigem aceite mútuo e retornam à busca quando faltam dados. /viagens, /perfil e /catalogo também estão disponíveis. Para inspecionar no navegador: npm run web. O Expo regenera os tipos das rotas ao iniciar; em checkout novo, inicie-o antes do typecheck. Não há scripts de publicação ou EAS nesta entrega. Os assets Expo existentes foram preservados e ainda não representam identidade final.

## Verificar

### Percorrer o fluxo completo automaticamente no navegador

Com o servidor local ativo (abaixo), `tools/e2e_browser.mjs` conduz o fluxo inteiro (endereços → busca → sugestões → espera → proposta → chat → resumo → viagem combinada → alterar/reconfirmar → Viagens/Perfil → cancelar) num Edge/Chrome real e salva uma captura por tela. Playwright não é dependência do projeto: `npm i --no-save playwright-core` antes de usar; `BROWSER_PATH` troca o navegador. O quinto argumento `nophoton` bloqueia o geocoder e escolhe partida/destino tocando no mapa. Este script comprova navegação e estados no navegador web, não gestos, GPS real ou Android.

### Testar o catálogo exportado no navegador

Em mobile/, com Python disponível:

```powershell
npm run export:web
python tools/serve_catalog.py
```

Abra http://127.0.0.1:8081/ para o fluxo ou http://127.0.0.1:8081/catalogo para o catálogo. O servidor é restrito a este computador e resolve as rotas exportadas sem extensão. Para encerrar, pressione Ctrl+C no terminal. Se o export já estiver atualizado, execute apenas o comando Python. A demo mantém os dados somente até recarregar a página. Para desenvolver com atualização automática, use npm run web.

Comece pelas cinco categorias: alterne tema/fonte, teste contador e simulação em Ações, nome vazio/preenchido e checkbox em Campos, modal em Feedback e manter/trocar nos dois sentidos em Produto. Use Tab/Shift+Tab e Escape; confira retorno do foco e legibilidade com zoom. Esses testes no navegador não substituem os testes Android abaixo.

```powershell
npm run check
npm run test:demo
npm run test:maps
npm run test:addresses
npx expo install --check
npm run doctor
npm run export:android
npm run export:web
```

check executa Biome e TypeScript. test:demo, test:maps e test:addresses executam testes de domínio, protocolo do mapa e seleção/consulta de endereços com Node e strip-types, sem rede ou serviços; Node 22 pode emitir avisos do recurso experimental e detecção de módulo. Os exports locais ficam em dist/android e dist/web; gerar bundle não comprova execução Android. Não há suíte automatizada de interação. Evidências reais e pendências estão em ../documentos/Auditoria_da_base.md e ../documentos/Passagem_de_trabalho.md.

## Organização

- src/app/: Expo Router (busca, sugestões, espera, proposta, chat, resumo, viagem, viagens, perfil e catálogo).
- src/ui/: tokens, tipografia, provider, componentes base e peças do produto.
- src/features/catalog/: catálogo com categorias Fundação, Ações, Campos, Feedback e Produto.
- src/features/demo/: telas, componentes comuns de jornada, estado em memória e regras puras de descoberta e negociação versionada.
- src/features/maps/: mapa real por plataforma, campos compartilhados, adaptador Photon, seleção/revisão dos locais, bridge validado, atribuição e assets Leaflet locais. Pontos da intenção reaparecem no mini-mapa de /busca.
- tests/demo-domain.test.mjs: regressões de regras, expiração e comandos obsoletos.
- tamagui.config.ts: temas semânticos claro/escuro e preset v5 sem compilador/driver de animação opcional. Fontes do sistema, sem download de fontes do app.
- package-lock.json: instalação reproduzível com npm ci.

## Checklist Android e visual (pendente no aparelho)

### Fluxo de companhia

- Abrir a raiz, conferir os dois campos vazios, pesquisar rua/bairro/cidade e selecionar ambos os locais. Testar sugestões, consulta vazia/falha, troca de campo com consulta pendente, limpeza e edição após seleção. Não iniciar com texto sem ponto confirmado. Fechar o diálogo não deve reabri-lo por restauração de foco. Conferir teclado/rolagem em 360 px e com fonte ampliada.
- Testar seleção no mapa, arraste, zoom, origem por GPS permitido/negado/indisponível e continuar digitando destino enquanto GPS está pendente: a resposta não deve fechar o diálogo ou mudar o foco. Sem geocoder, manter ponto com rótulo genérico. Conferir pontos no mini-mapa após iniciar a busca.
- Escolher saída futura, 1 pessoa e 400 m. Buscar abre busca ativa; ver sugestões mostra Evandro, depois Bruno e Camila conforme elegibilidade. Todas as caminhadas/perfis são fictícios; não há prova de proximidade geográfica real.
- Verificar erros de data inexistente, hora inválida/passada e limite vazio/negativo. Marcar horário fixo; Bruno deixa de ser compatível nesse cenário. Com acompanhante, Camila é excluída por ultrapassar 3 pessoas. Reduzir limite para ver o estado sem sugestões.
- Pular por botão e gesto à esquerda; rever puladas. Aceitar por botão e gesto à direita. Conferir que rolagem vertical continua disponível, inclusive com fonte ampliada.
- Aceitar Evandro, continuar vendo sugestões e aceitar Bruno. Fechar o diálogo pelo botão Fechar, Escape ou retorno Android mantém Evandro. Confirmar troca mostra os dois nomes e deixa só Bruno pendente.
- Cancelar solicitação mantém a busca; simular aceite da companhia abre proposta exclusiva, ainda sem viagem combinada. Reiniciar demo limpa os dados.
- Escolher saída poucos minutos à frente; conferir encerramento no horário original e revalidação ao retornar do segundo plano. Aceite mútuo simulado permanece após esse prazo. A demo não busca com o app fechado nem envia notificações.
- Abrir /sugestoes ou /espera diretamente/recarregar: voltar à busca sem intenção em memória. Capturar screenshots no celular da busca, sugestão, espera, modal e estados vazios; validar TalkBack, teclado e fonte do sistema ampliada. Estas verificações continuam pendentes.

### Negociação, chat e acordo

- Percorrer os sete passos acima. Conferir abas, mensagens longas, mensagem vazia desabilitada, teclado e rolagem para a última mensagem; o chat nunca confirma o acordo automaticamente.
- Conferir resumo com e sem acompanhante: metade por pessoa ou 2/3 para a conta com acompanhante, total até três passageiros em duas contas.
- Confirmar só de um lado mantém negociação; confirmar os dois abre acordo. Mudar trajeto invalida ambos; opção fora do limite de caminhada fica desabilitada.
- Com Bruno, os quatro atalhos mantêm o horário fixo dele. Uma parada aparece no resumo em sequência após o embarque principal.
- Deixar vencer o horário da busca após aceite mútuo: a negociação e eventual acordo permanecem. Cancelar depois do prazo encerra participação e exige nova busca.
- Retomar por Viagens, alternar chat/proposta/resumo e confirmar cancelamento pelo modal. Verificar fechamento pelo retorno Android e Escape no web.
- Testar viewport de 360 px, fonte ampliada e zoom: conteúdo rola e ações do rodapé permanecem acessíveis. Tema de jornada permanece claro como as referências; catálogo conserva alternância claro/escuro.

### Catálogo

- Abrir /catalogo; alternar categorias e tema, mantendo dados digitados/seleções.
- Inspecionar botões principal/secundário/pressionado/desabilitado/ocupado/falha; contador e conclusão da simulação.
- Validar nome vazio, preencher nome fictício e verificar mensagem; checkbox alterna horário fixo.
- Abrir modal, fechar por botão e pelo retorno Android. Abrir troca: fechar/manter preserva Evandro; confirmar troca para Bruno apenas localmente e mostra os dois nomes no resultado. Repetir no sentido Bruno → Evandro.
- Usar fonte do sistema ampliada, além da prévia de 150%; verificar rolagem, textos sem corte e botões de pelo menos 48 dp.
- Verificar teclado com campo focado, TalkBack, ordem de foco, anúncio de erro/seleção/ocupado e contraste nos dois temas.
- No web, verificar Tab/Shift+Tab, Escape no modal e retorno de foco ao acionador, viewport estreito e zoom. Conferir um único diálogo com nome acessível, campo inválido com mensagem associada e anúncio do resultado da troca.

A prévia de fonte não substitui a fonte ampliada do Android. O modal não usa animação; os estados usam texto além de cor. Dados de companhia ocultam fotos/endereços antes do aceite; distâncias são fictícias, com 400 m por extremo. MVP com dupla de contas e até três pessoas contando acompanhantes. A ação de troca no catálogo não implementa uma solicitação real.

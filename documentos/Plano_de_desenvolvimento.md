# Divide aí — plano de desenvolvimento

Versão 5 • 8 de outubro de 2026

## Objetivo e situação atual

Registrar a direção técnica discutida até agora. O orçamento vem dos recursos pessoais limitados do idealizador; o teto mensal ainda precisa ser definido. Priorizar uma primeira versão que permita validar o produto em um piloto concentrado, com custos acompanhados.

O projeto contém requisitos, imagens, um protótipo HTML e um rascunho Expo em mobile/. A implementação foi iniciada por engano e interrompida a pedido do usuário; o foco desta conversa é documentar e planejar. O rascunho não foi compilado ou validado e não está pronto para uso. Não existe backend implementado ou conectado. O estado verificável está em [Guia_para_agentes.md](Guia_para_agentes.md). O usuário aprovou a base técnica e as recomendações complementares em 8 de outubro de 2026. Este plano registra decisões e novas recomendações; não significa que serviços foram contratados, dependências instaladas ou uma aplicação foi publicada. Os requisitos funcionais continuam em [Divide_ai_requisitos.md](Divide_ai_requisitos.md).

## Organização compartilhada do desenvolvimento com LLMs

Alternar Codex e Claude Code por lote. No Codex, GPT-6.1 Sol conduz, planeja e implementa; GPT-6 Luna pesquisa arquivos/documentação, somente leitura; GPT-6 Astra assessora sob consulta. No Claude Code, Sonnet 5.5 conduz e implementa; Haiku 5.5 pesquisa; Opus 5.5 atua como advisor. Até duas pesquisas independentes simultâneas inicialmente. Uma ferramenta edita o lote por vez; o principal integra e verifica. Revisão cruzada começa somente leitura. Regras compartilhadas em Regras_de_desenvolvimento.md, estado em Passagem_de_trabalho.md e comandos/prompts em Guia_para_agentes.md. Configuração local e acesso aos modelos ainda precisam ser comprovados.

## Base planejada

| Camada | Direção atual | Situação |
|---|---|---|
| Aplicativo móvel | React Native + Expo + TypeScript | Aprovado como base do plano |
| Estilos e componentes | Tamagui | Aprovado pelo usuário |
| Padronização de código | Biome para lint, formatação e imports | Aprovado pelo usuário |
| Design system | Fundação pequena em código, com tokens e componentes reutilizáveis | Aprovado para a primeira etapa |
| Navegação | Expo Router | Aprovado |
| Dados remotos | TanStack Query + cliente do Supabase | Aprovado |
| Formulários | React Hook Form + Zod | Aprovado |
| Gestos e animações | Gesture Handler + Reanimated para os cards | Aprovado; validar versões com Expo |
| Backend gerenciado | Supabase | Aprovado como backend inicial |
| Banco | PostgreSQL + PostGIS | Aprovado como banco inicial |
| Login, fotos e chat | Supabase Auth, Storage e Realtime | Serviços aprovados; login por OTP no e-mail |
| Regras e integrações | Funções transacionais no PostgreSQL e Edge Functions em TypeScript | Arquitetura aprovada |
| Notificações e builds | Expo Notifications / serviço de push e EAS Build | Direção aprovada; validar em development build |

Escolher versões compatíveis na criação do app, fixá-las no arquivo de dependências quando necessário e manter o lockfile. Antes de ampliar a implementação, rodar uma tela com Tamagui em uma build de desenvolvimento do Expo no aparelho.

Tamagui oferece estilos, temas, tokens e componentes para React Native; no aplicativo móvel a composição usa componentes e propriedades de estilo, em vez de um arquivo CSS tradicional. Começar com os recursos necessários e avaliar o compilador opcional conforme o projeto. Referências: [introdução](https://tamagui.dev/docs/intro/introduction), [guia Expo](https://tamagui.dev/docs/guides/expo).

Biome será a ferramenta principal de lint e formatação. A verificação de tipos continua separada, com TypeScript. Avaliar a cobertura das regras relevantes de React/React Native; acrescentar uma verificação específica somente se houver uma lacuna concreta. Referência: [Biome](https://biomejs.dev/installation/quick-start/).

## Design system inicial

Criar a fundação antes de montar as telas e validá-la imediatamente nas telas 01–04. A biblioteca cresce a partir dos componentes realmente utilizados; a identidade visual ainda pode evoluir.

- Tokens semânticos de cores: fundo, superfície, texto, texto secundário, ação principal, borda, sucesso, atenção e erro. Partir da paleta atual: neutros claros, texto escuro e verde.
- Tipografia, escala de espaçamentos, tamanhos de ícone, raios de borda e sombras. Usar os mesmos tokens entre componentes.
- Componentes iniciais: texto, botão, campo de entrada, checkbox, card, badge, alerta, modal, cabeçalho e estados vazio/erro/carregamento.
- Componentes do produto: resumo de trajeto, intervalo de horário, caminhada, card de companhia e confirmação de troca de solicitação.
- Estados de interação: pressionado, desabilitado, enviando e falha. Dar feedback claro sem depender só de cor.
- Acessibilidade: rótulos para leitores de tela, aumento de fonte, contraste, áreas de toque, teclado e redução de movimento. Gestos devem ter botões equivalentes.

Usar Tamagui como fundação e criar componentes próprios onde houver uma necessidade do produto. Manter uma tela interna de catálogo para inspecionar componentes e seus estados. A primeira etapa não exige uma biblioteca Figma completa nem componentes de partes do produto ainda indefinidas.

## Organização do aplicativo

Um único projeto móvel inicialmente. Separar rotas, componentes de UI, funcionalidades e integração com serviços. A organização proposta é: projeto móvel em mobile/ e rotas em mobile/src/app/; tokens e componentes em src/ui/; funcionalidades em src/features/; integração com Supabase em src/services/; utilitários compartilhados apenas quando usados por mais de uma funcionalidade. As migrations e funções do backend ficam versionadas no mesmo repositório.

Expo Router cuida das rotas. TanStack Query cuida de consultas, cache, carregamento, falhas e atualização dos dados remotos. Conectar foco do app e reconexão às consultas; eventos do Realtime devem atualizar ou invalidar os dados correspondentes. Estado local simples fica em React; avaliar uma biblioteca global de estado apenas quando aparecer necessidade real.

React Hook Form e Zod ajudam no cadastro e na intenção de viagem. TypeScript descreve os tipos; Zod valida dados em execução. O servidor deve validar novamente permissões e regras. Horários devem ser armazenados como instantes com referência de fuso, para tratar datas, viagens futuras e janelas que cruzam meia-noite.

Planejar persistência da sessão com armazenamento adequado ao aparelho e ao adaptador do Supabase. SecureStore é uma opção a validar, inclusive limites de tamanho e divisão do payload quando necessária. Não persistir indiscriminadamente chat, endereços ou dados pessoais em caches locais. Operações de aceite, troca e confirmação devem ter resposta do servidor; uma falha de rede não pode ser apresentada como sucesso.

Referências: [Expo Router](https://docs.expo.dev/router/introduction/), [TanStack Query no React Native](https://tanstack.com/query/latest/docs/framework/react/react-native), [React Hook Form](https://github.com/react-hook-form/react-hook-form), [Zod](https://zod.dev/), [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Backend e dados

Supabase é a proposta principal para o piloto: reúne PostgreSQL, autenticação, armazenamento, APIs e atualização em tempo real. Um backend próprio em Node.js/TypeScript com PostgreSQL no RDS permanece uma alternativa futura se requisitos ou operação justificarem. AWS é infraestrutura; SQL é uma linguagem de banco. O plano inicial usa um banco relacional gerenciado, sem administrar diretamente toda a infraestrutura AWS. Referência: [arquitetura do Supabase](https://supabase.com/docs/guides/getting-started/architecture).

Modelar usuários e dados privados, intenções, solicitações, negociações/grupos, participantes e acompanhantes, propostas versionadas, confirmações, mensagens, avaliações, denúncias e bloqueios. Separar campos públicos dos dados privados e registrar as mudanças importantes de estado.

Operações críticas devem ser transacionais: uma solicitação/negociação ativa por usuário, troca sem perder a anterior em caso de falha, limite de três passageiros e confirmação da mesma versão. O MVP usa duplas de contas, podendo incluir acompanhantes; entrada de terceira conta com consentimento é referência futura, fora do MVP. Prever idempotência para reenvios após falha de rede e verificação do estado atual para eventos simultâneos.

Configurar permissões por usuário e por participação. A API precisa impedir leitura de endereços e avaliações ocultas; esconder esses dados na tela é insuficiente. Credenciais administrativas ficam apenas no servidor.

A busca deve funcionar com o app fechado. Disparar verificações por criação/alteração de intenções e mudanças de estado; usar tarefas agendadas para encerramento e lembretes. Atualização em tempo real serve para comunicar mudanças, não substitui o processamento da busca. Notificações precisam de fila ou registro de trabalho, tentativas e tratamento de tokens inválidos.

PostGIS ajuda a selecionar candidatos geograficamente próximos. O limite de caminhada exige rotas a pé: não basta medir linha reta. Escolher o fornecedor de mapas, busca de endereços e rotas antes de implementar essa parte; acompanhar consumo e respeitar as condições de armazenamento/cache do fornecedor.

## Regras já estabelecidas

- Disponibilidade flexível de ±15 minutos; “Preciso sair nesse horário” define um instante fixo. Compatibilidade pela interseção das janelas, incluindo extremos.
- Caminhada até o embarque e do desembarque ao destino, com limite individual aplicado separadamente em cada extremo. Limite inicial confirmado de 400 m, ajustável.
- Busca e solicitações pendentes encerram no horário originalmente escolhido, mesmo com flexibilidade. Uma viagem já confirmada permanece válida.
- Enquanto aguarda resposta, o usuário explora e pula sugestões com uma solicitação pendente. Aceitar outra exige confirmar explicitamente qual será cancelada e qual será enviada.
- Aceite mútuo abre negociação exclusiva; todos confirmam a mesma versão do resumo. Até três passageiros, contando acompanhantes.
- Foto e endereços exatos ocultos antes do aceite mútuo. A remoção de textos explicativos na tela 03 não altera essa regra.
- Uber/99 e pagamento acontecem por fora na primeira versão. IA analisando chat está fora do escopo inicial.

A variação visual “Você já tem uma carona reservada” não definiu uma nova regra para trocar uma viagem já combinada ou iniciar negociações paralelas. Se essa possibilidade entrar no produto, especificar os efeitos e consentimentos antes de implementá-la.

## Qualidade, custos e operação

Versionar código, migrations e configurações. Configurar checagens automáticas de Biome, TypeScript e testes das regras críticas. Testar compatibilidade de horários, troca concorrente, capacidade, reconfirmação e permissões. Verificar os fluxos essenciais no aparelho, inclusive offline/reconexão, teclado, fonte ampliada e notificações. A ferramenta de testes será escolhida na criação do projeto conforme a base Expo.

Separar desenvolvimento e piloto/produção conforme o custo e a fase. Definir backup e procedimento de restauração antes de usar dados reais. Registrar erros e eventos úteis sem expor chat, telefones, credenciais ou localização privada nos logs. Escolher ferramenta de monitoramento quando a primeira build estiver pronta para usuários externos.

Prioridade confirmada: o menor custo possível. Planejar desenvolvimento e piloto pequeno usando faixas gratuitas, com meta inicial de mensalidade fixa de serviços próxima de zero. Um teto numérico e os gastos únicos aceitáveis ainda precisam ser definidos. Separar orçamento para backend, mapas/rotas, envio de e-mail, domínio, builds e conta Android; SMS e WhatsApp ficam para uma fase futura. Validar limites dos planos, configurar restrições de chaves e acompanhar consumo. Alertas de orçamento avisam; não devem ser tratados como garantia de bloqueio de gastos. Não foi assumida gratuidade permanente ou preço mensal fechado.

## Sequência proposta

1. Criar a base Expo/TypeScript, Tamagui e Biome; validar compatibilidade numa build de desenvolvimento.
2. Criar tokens e componentes essenciais do design system; montar uma tela de catálogo.
3. Implementar as primeiras telas e estados aprovados, incluindo busca, sugestões, espera e troca, inicialmente com dados de demonstração.
4. Implementar autenticação, modelo de dados, permissões e operações transacionais; conectar o fluxo de duas pessoas até a confirmação do mesmo resumo.
5. Integrar mapas/rotas, processamento de busca, atualização em tempo real e notificações; validar no aparelho e em um piloto controlado.
6. Completar cancelamentos, avaliações, denúncia/bloqueio e suporte antes de ampliar a distribuição. Busca e inclusão de terceira conta ficam fora do MVP, que usa duplas de contas e até três pessoas contando acompanhantes.

## Decisões ainda necessárias

Teto mensal numérico e gastos únicos aceitáveis; validação de domínio/remetente no Resend; URL e chave pública do Supabase; validação futura da proposta Google Maps/Places/Routes e quotas; regras pendentes de grupo, avaliação e moderação. Android primeiro e autenticação por OTP no e-mail estão definidos. Nenhum cronograma foi prometido. As recomendações de bibliotecas complementares devem ser reavaliadas se aumentarem complexidade sem ajudar os fluxos reais.

## Decisões confirmadas — autenticação e plataforma

- Login e cadastro sem senha, usando código OTP enviado ao e-mail pelo Supabase Auth. SMS e WhatsApp são possibilidades futuras, fora do login inicial.
- Android primeiro, com iOS em uma etapa posterior. React Native/Expo continua sendo a base para preparar essa evolução.
- Prioridade de custo mínimo; nenhum valor mensal específico foi autorizado. O usuário informou configuração de domínio e chave do Resend; nenhum plano pago foi contratado por este agente.

### Fluxo de login proposto

Informar e-mail → receber código → validar código → completar perfil no primeiro acesso. Configurar o template do Supabase para enviar o código, em vez de um magic link. Validade de 10 minutos e reenvio após 60 segundos são decisões confirmadas; sua configuração e a entrega real ainda precisam ser testadas. Controle de tentativas permanece a especificar.

Login sempre por OTP significa que não há autenticação por senha. Recomenda-se manter a sessão no aparelho e renová-la para evitar pedir código em toda abertura; solicitar OTP quando for necessário autenticar novamente. O e-mail verifica acesso à caixa postal, não identidade civil nem posse de telefone. Se o telefone continuar no perfil, identificá-lo como não verificado por este fluxo. Troca de e-mail e recuperação quando houver perda de acesso precisam de regra.

O SMTP padrão do Supabase não serve para o piloto com usuários externos: há restrição aos e-mails da equipe e baixa capacidade de envio. Decisão para o envio inicial: SMTP próprio via Resend integrado ao Supabase Auth. O usuário informou o domínio divideai.com e forneceu uma chave já armazenada localmente. A verificação DNS e um envio real ainda não foram realizados por este agente. O remetente confirmado é Divide aí <acesso@divideai.com>, ainda sem teste de entrega. A faixa gratuita consultada em 08/10/2026 oferece 3.000 e-mails/mês e 100/dia. O serviço exige domínio próprio verificado; utilizar divideai.com após conferir o estado de verificação. O limite diário importa em um piloto concentrado e os reenvios também consomem capacidade. Configurar remetente, autenticação do domínio e testar entrega em diferentes provedores.

Referências: [OTP no Supabase](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP próprio](https://supabase.com/docs/guides/auth/auth-smtp), [Resend e preços](https://resend.com/pricing), [domínio verificado](https://resend.com/docs/dashboard/domains/introduction).

### Mapas e rotas — proposta para validar

Usar uma experiência familiar de mapa, pesquisa de endereço, seleção do ponto e visualização dos trajetos. A inspiração em Uber/iFood é de experiência; não foi adotada nem presumida a infraestrutura dessas empresas.

Fase inicial sem consumo de APIs de mapas: usar adaptadores de demonstração para desenvolver e testar a interface. Esses dados devem estar identificados como fictícios, inclusive caminhadas. A integração real é uma etapa posterior; não abrir billing ou habilitar serviço faturável nesta fase. O piloto com pessoas reais depende de rotas de caminhada reais ou pontos previamente validados e regras de cobertura definidas.

Proposta para essa integração futura: Google Maps SDK no Android, Places para pesquisa de locais e Routes API para caminhada e trajeto de carro quando necessário. A biblioteca React Native que integra o SDK será validada com Expo na criação do app. Não usar uma integração web de mapa no lugar do SDK nativo sem avaliar impacto em UX e custo.

Na tabela consultada em 08/10/2026, Maps SDK aparece com faixa gratuita ilimitada; Autocomplete Requests e Routes Compute Routes Essentials têm 10.000 eventos gratuitos por mês cada. A cobrança é por SKU e os recursos/parametrização podem mudar a categoria. Isso não significa 10.000 viagens gratuitas: uma busca pode envolver múltiplas consultas e vários trechos. Habilitar apenas os serviços necessários; respeitar regras de atribuição e armazenamento.

A conta Google Maps exige configuração de billing. Usar quotas compatíveis com as faixas gratuitas, controle de consumo no backend, restrições de chaves e limites por usuário. A meta do piloto é operar dentro dessas faixas. Ao atingir o limite planejado, limitar consultas e informar indisponibilidade temporária. Alertas de orçamento não são um bloqueio de cobrança; nenhuma garantia de custo zero foi assumida.

PostGIS filtra candidatos por geografia e o banco filtra horário, capacidade e bloqueios antes de chamar rotas. Consultar caminhadas apenas para candidatos/pontos plausíveis e limitar quantas opções serão calculadas por busca. A distância final continua sendo por rota a pé, não linha reta. Validar os pontos do piloto presencialmente; o Google informa limitações de rotas a pé e exige exibir os avisos aplicáveis.

Referências: [preços por serviço](https://developers.google.com/maps/billing-and-pricing/pricing), [billing e quotas de Routes](https://developers.google.com/maps/documentation/routes/usage-and-billing), [opções e limitações de rotas](https://developers.google.com/maps/documentation/routes/route-opt).

### Estratégia de custo para começar

| Item | Plano inicial | Limite ou gasto a considerar |
|---|---|---|
| Backend | Supabase Free no desenvolvimento/piloto pequeno | Limites de recursos; pausa por inatividade; revisar backup e disponibilidade antes de ampliar |
| OTP por e-mail | Resend, com objetivo de permanecer no Free | 100 e-mails/dia e 3.000/mês; domínio próprio necessário |
| Mapas e rotas | Google Maps SDK e APIs dentro das faixas gratuitas, recomendado | Billing configurado, consumo separado por SKU e quotas limitadas |
| Android | Builds de teste antes da publicação | Google Play cobra inscrição única de US$25; revisar requisitos de teste para a conta |
| Domínio | divideai.com informado pelo usuário | Verificação e renovação conforme registro existente |

Fazer os primeiros testes em aparelhos Android do grupo piloto. Para publicação na loja, seguir os requisitos atuais da conta do Play Console. Fontes de custos: [Supabase](https://supabase.com/pricing), [Resend](https://resend.com/pricing), [Google Maps](https://developers.google.com/maps/billing-and-pricing/pricing), [Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=pt-BR). Preços e limites consultados em 08/10/2026; conferir novamente na contratação.

## Documentos para execução futura

Começar por [LEIA_PRIMEIRO.md](LEIA_PRIMEIRO.md). O [roteiro de implementação](Roteiro_de_implementacao.md) define etapas e evidências de conclusão; os [contratos técnicos](Contratos_tecnicos.md) são propostas para revisão pelo agente principal; o [guia para agentes](Guia_para_agentes.md) explica as duas arquiteturas de modelos, a alternância e o estado real do projeto. [Decisoes_e_pendencias.md](Decisoes_e_pendencias.md) centraliza o que foi confirmado e o que ainda depende do idealizador. Nesta conversa, o escopo permanece documentação e planejamento.

# Divide aí — comece aqui

Atualizado em 11 de outubro de 2026. Desenvolvimento alternado com Codex e Claude Code. Começar pela Passagem_de_trabalho.md e pelas Regras_de_desenvolvimento.md. O pedido atual autorizou corrigir as quatro primeiras telas pelo design e continuar o fluxo principal como MVP mockado, sem assinatura, billing, cobrança ou serviço pago.

## Ordem de leitura

1. [Decisoes_e_pendencias.md](Decisoes_e_pendencias.md): decisões do idealizador e questões em aberto.
2. [Divide_ai_requisitos.md](Divide_ai_requisitos.md): requisitos funcionais e critérios de aceitação.
3. [Plano_de_desenvolvimento.md](Plano_de_desenvolvimento.md): stack, arquitetura, custos e integrações.
4. [Contratos_tecnicos.md](Contratos_tecnicos.md): proposta de modelo de dados, estados e operações.
5. [Roteiro_de_implementacao.md](Roteiro_de_implementacao.md): dependências das etapas e o que comprova conclusão.
6. [Guia_para_agentes.md](Guia_para_agentes.md): papéis de Sol/Luna/Astra e Sonnet/Haiku/Opus, comandos e prompts de partida.
7. [Integracao_backend.md](Integracao_backend.md): como ligar o app ao backend por `.env`, contrato HTTP, adaptadores de login/e-mail, endereços e mapa, backend falso e pendências.

## Como interpretar as fontes

A instrução atual do usuário tem prioridade. Decisões confirmadas e requisitos prevalecem sobre hipóteses das telas ou escolhas do rascunho. Contratos e decomposição técnica são propostas de execução, revisáveis pelo agente principal desde que preservem o comportamento aprovado. Se houver conflito entre documentos, registrar e resolver antes da parte afetada; continuar tarefas independentes. Não converter pendências em regras oficiais.

O arquivo Pedido-original.txt é contexto histórico de design. O protótipo Divide-ai-MVP.html e as imagens em telas/ são referências visuais com dados fictícios. O Figma está parcial. O idealizador esclareceu nesta tarefa que desenvolveu até a tela 04; as telas posteriores foram geradas por um agente como MVP. Usar 01–04 como padrão visual e adaptar as posteriores, preservando os requisitos confirmados. Isso não aprova automaticamente regras sugeridas pelas imagens. A variação visual de carona reservada não define regras adicionais de negociação.

## Arquitetura de LLMs

Alternar Codex e Claude Code por lote. No Codex, GPT-6.1 Sol conduz, planeja e implementa; GPT-6 Luna pesquisa arquivos/documentação, somente leitura; GPT-6 Astra assessora sob consulta. No Claude Code, Sonnet 5.5 conduz e implementa; Haiku 5.5 pesquisa; Opus 5.5 atua como advisor. Até duas pesquisas independentes simultâneas inicialmente. Uma ferramenta edita o lote por vez; o principal integra e verifica. Revisão cruzada começa somente leitura. Regras compartilhadas em Regras_de_desenvolvimento.md, estado em Passagem_de_trabalho.md e comandos/prompts em Guia_para_agentes.md. Configuração local e acesso aos modelos ainda precisam ser comprovados.

## Resumo da direção

Android primeiro, iOS depois. React Native + Expo + TypeScript; Tamagui; Biome; design system pequeno; Expo Router; TanStack Query; React Hook Form + Zod; Gesture Handler + Reanimated. Backend no Supabase com PostgreSQL/PostGIS, Auth, Storage, Realtime, funções e tarefas agendadas.

Login sem senha por OTP no e-mail. Envio via Resend integrado ao Supabase Auth. Domínio informado: divideai.com. Usar credenciais privadas exclusivamente na configuração do servidor ou do SMTP. Pedido de 11/10 autorizou mapa real OpenStreetMap, seleção de pontos e GPS explícito; refinamento exige dois campos empilhados com nomes de ruas/bairros, sem entrada de coordenadas. Busca de endereços usa Photon público para teste moderado, sem chave/billing. Rotas, caminhadas e companhias continuam simuladas, sem consumo de APIs faturáveis. Integração Google Maps/Places/Routes é proposta futura, sujeita a validação de custo e quotas.

## Estado atual

A base Expo tem lockfile, catálogo Tamagui, mapa real OpenStreetMap e fluxo demo de entrada por e-mail (código simulado) e cadastro, busca, sugestões, espera/troca, proposta (escolha da mesma opção), chat, viagem combinada e cancelamento, mais o ciclo pós-viagem (lembrete, avaliação com reciprocidade, viagem não realizada, denunciar/bloquear), com telas de viagens/perfil demo. O frontend mockado cobre todas as telas do MVP; falta validação no aparelho e tudo que depende de backend. Consulte [Passagem_de_trabalho.md](Passagem_de_trabalho.md) e [mobile/README.md](../mobile/README.md) para verificações e roteiro navegável. Execução Android e validação visual não devem ser inferidas da compilação. Existe backend em SQL (supabase/migrations, testado só em PGlite) mas nenhum projeto Supabase conectado nem migration aplicada; envio de e-mail, contratação ou publicação.

## Próximo passo nesta fase

O fluxo completo já foi percorrido num navegador real por script (tools/e2e_browser.mjs; ver passagem). Falta validar no aparelho Android e conferir gestos, teclado e GPS real conforme o checklist de mobile/README.md. O lote atual é frontend mockado e não comprova a etapa 5 real: autenticação, backend, geografia e operação têm dependências pendentes. Orçamento atual confirmado em zero: não ativar assinaturas, billing, cobranças, e-mails ou publicação.

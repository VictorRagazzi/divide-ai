# Divide aí — regras compartilhadas de desenvolvimento

Atualizado em 8 de outubro de 2026. Codex e Claude Code trabalham sobre os mesmos requisitos e decisões.

## Entrada e prioridade

Leia documentos/Passagem_de_trabalho.md, depois documentos/LEIA_PRIMEIRO.md e os documentos na ordem indicada. Antes de alterar mobile/, leia mobile/AGENTS.md. A instrução atual do idealizador prevalece; decisões confirmadas prevalecem sobre hipóteses de telas e código. Pendências não viram regras por decisão do agente.

## Papéis e delegação

| Papel | Codex | Claude Code |
|---|---|---|
| Principal: planejar, implementar, integrar e verificar | GPT-6.1 Sol | Sonnet 5.5 |
| Pesquisa: arquivos e documentação | GPT-6 Luna | Haiku 5.5 |
| Assessor: decisões importantes, erros recorrentes e lacunas | GPT-6 Astra | Opus 5.5 |

Delegue pesquisas delimitadas e independentes aos modelos de pesquisa quando isso ajudar. Comece com uma; use até duas simultâneas inicialmente. Pesquisadores trabalham somente em leitura: sem edições, instalação, builds, comandos que escrevam, mensagens externas ou acesso a segredos. Retorne evidências resumidas, arquivos/linhas ou links oficiais e incertezas.

No Codex, use Luna com esforço high para pesquisas e Astra com esforço low para consultas; o principal Sol usa medium inicialmente. Quando o cliente permitir escolher modelo no envio, envie apenas o contexto relevante em vez de copiar todo o histórico. Consulte Astra como subagente assessor somente diante de decisão importante, erro recorrente ou revisão de lacunas de entrega complexa. No Claude Code, Opus cumpre esse papel pelo advisor. Consulte documentos/Guia_para_agentes.md para configuração.

Confira os modelos efetivos. Se indisponíveis, relate e prossiga com o principal nas partes possíveis, sem afirmar que a delegação ou o assessor configurado funcionaram. Não substituir silenciosamente por um modelo mais caro. A resposta de um assessor não substitui testes ou aprovação de regra de produto.

## Alternância de ferramentas

Uma ferramenta conduz e edita cada lote. Antes da troca, atualize documentos/Passagem_de_trabalho.md com escopo, arquivos, verificações reais, limitações e próximo passo. A próxima ferramenta relê os arquivos e inspeciona o estado local; o chat anterior não é requisito. Não iniciar edições concorrentes de Codex e Claude no mesmo lote. Para revisão cruzada, a segunda ferramenta começa somente em leitura e devolve achados concretos; correções seguem o escopo autorizado.

## Escopo e qualidade

O pedido desta sessão prepara documentação e passagem. A implementação do app começa quando o usuário abrir uma tarefa explícita. Dentro de um escopo autorizado, prossiga sem confirmações redundantes. Android primeiro, TypeScript, Tamagui e Biome são decisões confirmadas. Comece pela auditoria do rascunho; preserve alterações locais. Use dados e rotas demo inicialmente.

O principal controla dependências, lockfile, configurações, layouts comuns, schemas e migrations. Não rodar dois instaladores simultaneamente. Validar versões Expo em documentação correspondente ao SDK. Executar lint e typecheck nas entregas de código e testes pertinentes às regras afetadas. Não declarar execução Android, backend ou publicação com base apenas em compilação/review.

Não ativar APIs faturáveis, enviar e-mails ou publicar fora do escopo explicitamente autorizado. Não presumir backend, DNS ou SMTP funcionando. Nunca copiar segredos para código, prompts, logs ou documentos; pesquisadores não leem .env.server.local.

## Decisões já registradas que prevalecem

Caminhada inicial: 400 m ajustáveis, aplicada separadamente em cada extremo. MVP com duplas, sem inclusão de terceiro usuário nesta fase; limite existente de três passageiros contando acompanhantes continua registrado e não deve ser confundido com três contas. OTP: 10 minutos, reenvio após 60 segundos; remetente acesso@divideai.com confirmado, entrega ainda não testada. Trechos históricos divergentes nos demais documentos estão identificados na passagem e devem ser sincronizados antes da implementação afetada.

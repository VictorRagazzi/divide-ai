# Divide aí — roteiro de implementação futura

Versão 3 • 8 de outubro de 2026. Etapas abaixo não foram executadas ou aprovadas como concluídas. São uma ordem de trabalho para quando o idealizador autorizar o início.

## Entregas e dependências

| Etapa | Entrega | Dependências | Evidência de conclusão |
|---|---|---|---|
| 0 — Auditar e estabilizar base | Revisar mobile/, versões do SDK, dependências, rotas e scripts; confirmar reaproveitamento | Tarefa explícita de implementação | Diagnóstico, lockfile, instalação concluída, lint e typecheck válidos; rotas inexistentes resolvidas |
| 1 — Fundação visual | Tokens Tamagui, componentes e catálogo interno | Etapa 0 | Catálogo funcional; estados de botão/campo/card/modal; leitura com fonte ampliada e áreas de toque adequadas |
| 2 — Primeiras telas | Busca, sugestões, espera e modal de troca em modo demonstração | Etapa 1 | Fluxo navegável por botão e gesto, sem falsos dados reais; screenshots no celular |
| 3 — Autenticação | E-mail → OTP → sessão → perfil | Etapa 0; Supabase e SMTP configuráveis; decisões de cadastro | E-mail/código inválidos tratados, reenvio controlado, sessão restaurada, logout e envio real comprovado somente após configuração |
| 4 — Dados e permissões | Migrations, estados, RPCs, RLS e acesso a fotos/chat | Contratos revisados; Supabase; regras de solicitações simultâneas | Testes com usuários A/B/C e não participante; consultas não vazam localização ou avaliações; operações transacionais |
| 5 — Fluxo real de duas pessoas | Intenção, sugestão, aceite mútuo, chat, proposta, confirmação e cancelamento | Etapas 2–4 | Mesma informação em dois clientes, troca concorrente consistente, resumo alterado exige reconfirmação; preço/pagamento externos |
| 6 — Geografia e notificações | Seleção de pontos, rotas a pé, jobs, push e quotas | Fornecedor/limites definidos; development build | Distâncias verdadeiras, capacidade de uso limitada, encerramento efetivo pelo servidor, push e reconexão verificados |
| 7 — Terceira conta (futuro, fora do MVP) | Inclusão consensual de terceira conta, alteração e desistência | Nova autorização; fluxo da dupla; decisões de grupo | Nunca excede três pessoas; todos aceitam versão necessária; tentativa frustrada conforme regra aprovada |
| 8 — Confiança e operação | Avaliações, ausências, denúncia/bloqueio, suporte e administração mínima | Decisões de feedback e moderação | Reciprocidade respeitada, bloqueados excluídos da busca, acesso administrativo restrito |
| 9 — Piloto Android | Build distribuível, observação de falhas, métricas e recuperação | Etapas necessárias à experiência real; operação e custos fechados | Checklist de fluxos no aparelho, requisitos da distribuição atendidos, rollback/restauração e consumo acompanhados |

Uma demonstração interna pode acontecer nas etapas 1–2. Um teste funcional restrito da dupla pode acontecer após as etapas necessárias ao seu escopo. O MVP usa duplas de contas, sem inclusão de terceira conta; mantém até três passageiros contando acompanhantes. Avaliações e segurança continuam no plano, com pendências próprias. A etapa 7 depende de autorização futura e não bloqueia o MVP.

## Pesquisa, implementação e alternância

Alternar Codex e Claude Code por lote. No Codex, GPT-6.1 Sol conduz, planeja e implementa; GPT-6 Luna pesquisa arquivos/documentação, somente leitura; GPT-6 Astra assessora sob consulta. No Claude Code, Sonnet 5.5 conduz e implementa; Haiku 5.5 pesquisa; Opus 5.5 atua como advisor. Até duas pesquisas independentes simultâneas inicialmente. Uma ferramenta edita o lote por vez; o principal integra e verifica. Revisão cruzada começa somente leitura. Regras compartilhadas em Regras_de_desenvolvimento.md, estado em Passagem_de_trabalho.md e comandos/prompts em Guia_para_agentes.md. Configuração local e acesso aos modelos ainda precisam ser comprovados.

O principal implementa UI, domínio e backend, controla arquivos compartilhados e valida cada entrega. Os pesquisadores não editam código nem executam instaladores/builds. Consultar o assessor para revisão de plano relevante, falha recorrente ou lacunas de entrega complexa. Pesquisa e review não comprovam execução Android ou integração.

Não executar dois instaladores simultaneamente. Integração bloqueada por configuração externa deve produzir código testável com adaptador local e relatar a limitação. Antes de alternar ferramenta, registrar escopo autorizado, arquivos, verificações e próximo passo na passagem de trabalho.

## Casos essenciais para testes

- Janelas que se encontram em apenas um instante; horários fixos diferentes; virada de dia e fuso.
- Expiração no horário original mesmo com flexibilidade; solicitação recusada pelo servidor após prazo, mesmo se o job ainda não rodou.
- Explorar/pular sem alterar a solicitação; fechar modal; trocar com alvo indisponível; aceite da anterior durante a troca.
- Duas operações simultâneas de aceite, capacidade ou edição; reenvio de requisição sem duplicação.
- Acompanhante ocupa vaga e responde por duas partes; soma nunca passa de três.
- Confirmações vinculadas à versão; confirmação atrasada de versão antiga não conta.
- Endereços/fotos antes do aceite; chat acessível apenas aos participantes; avaliação oculta; bloqueio fora do fluxo de feedback.
- Falha de rede, reconexão, notificações repetidas e retorno ao app; erro de OTP ou entrega de e-mail.

Testes de UI devem validar ações e resultados relevantes. Verificações do servidor precisam demonstrar regras e permissões; componentes estáticos simples podem ser verificados visualmente. Não repetir uma bateria inteira sem mudança ou preocupação que justifique.

## Relato ao concluir cada entrega

Informar problema resolvido, comportamento resultante, arquivos afetados, verificações realmente executadas e limitações. Distinguir compilação, teste automatizado, execução no navegador e execução Android. Manter o estado da tarefa e decisões atualizado para o próximo agente. Não considerar uma aprovação de review como prova de teste no dispositivo.

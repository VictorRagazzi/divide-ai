# Divide aí — decisões e pendências

Versão 3 • 8 de outubro de 2026. Este documento registra o fechamento da conversa; detalhes de produto estão no levantamento de requisitos.

## Confirmado pelo idealizador

| Tema | Decisão |
|---|---|

| Produto | Encontrar passageiros compatíveis e combinar uma corrida solicitada por fora no Uber/99 |
| Plataforma | Android primeiro; iOS em etapa posterior |
| Frontend | React Native + Expo + TypeScript, Tamagui, Biome, design system inicial e bibliotecas complementares do plano |
| Backend | Supabase e PostgreSQL/PostGIS como base inicial |
| Login | OTP por e-mail, sem senha; SMS e WhatsApp ficam para depois |
| Envio de e-mail | Resend; domínio informado divideai.com; chave privada salva localmente |
| Horário | Janela individual de ±15 minutos; “Preciso sair nesse horário” elimina flexibilidade |
| Limite de caminhada inicial de 400 m, ajustável | Valor inicial confirmado |
| Compatibilidade de horário | Interseção das janelas, incluindo extremos: 18h e 18h30 flexíveis combinam às 18h15 |
| Proximidade | Caminhada até o embarque e do desembarque ao destino, limitada separadamente em cada trecho |
| Expiração | Busca e solicitações pendentes vencem no horário originalmente escolhido, sem estender pela flexibilidade |
| Sugestões | Navegar livremente; pular pode permitir reaparecimento ao reabrir, se o perfil continuar elegível |
| Solicitações | Uma pendente por vez; aceitar outra exige modal de troca com nomes e consequência explícitos |
| Negociação | Aceite mútuo, depois cada um escolhe uma opção concreta (conteúdo comparado, não o botão); a viagem fecha quando as escolhas coincidem e mudar a escolha desfaz o acordo (sem etapa separada de resumo; demo 12/10/2026) |
| Capacidade e rateio | Até três passageiros contando acompanhantes; divisão igual por pessoa |
| Privacidade inicial | Foto e endereços exatos ocultos antes do aceite mútuo |
| Orçamento | Prioridade ao menor custo possível; início sem gastos com mapas |
| Restrição atual de orçamento (10/10/2026) | Projeto sem orçamento; não ativar nenhuma assinatura, billing ou serviço pago |
| Referência visual (10/10/2026) | Idealizador desenvolveu até a tela 04; telas seguintes geradas por agente devem adotar os padrões das primeiras quatro |
| Lote atual (10/10/2026) | Correção visual e fluxo principal mockado autorizados, incluindo proposta/chat/resumo/acordo; sem integração real ou publicação |
| Preparação para integração (12/10/2026) | Idealizador pediu o protótipo pronto para o backend: configuração por `.env`, adaptadores de login/e-mail, dados, endereços e mapa. Implementado e testado só contra backend falso; ver Integracao_backend.md. Nenhum serviço real ativado |
| Remetente Divide aí <acesso@divideai.com> | Confirmado mas não testado |
| OTP válido por 10 minutos e reenvio após 60 segundos | Confirmado |
| Google Maps SDK + Places + Routes | Proposta de integração futura; faturamento não habilitado nesta fase |
| Busca de terceiro após confirmar a dupla | No momento não implementar, MVP com apenas duplas |
| Tentativa com terceiro frustrada preserva acordo da dupla | No momento não implementar, MVP com apenas duplas |
| Revelação de avaliações por par no grupo de três | No momento não implementar, MVP com apenas duplas |
| Trabalho atual | Documentar o plano para agentes futuros; implementação local interrompida |

## Confirmado em 13 de outubro de 2026 (backend)

- Distância de caminhada = percurso a pé calculado no mapa (não linha reta). Fornecedor de rotas ainda a escolher.
- Fim da viagem = 1 hora depois do horário combinado.
- O endereço da outra pessoa aparece depois do aceite mútuo, ao escolher o ponto dela.
- Quem nunca avalia recebe nota; só não vê as avaliações até avaliar.

## Direção de execução escolhida nesta passagem

Alternar Codex e Claude Code por lote. No Codex, GPT-6.1 Sol conduz, planeja e implementa; GPT-6 Luna pesquisa arquivos/documentação, somente leitura; GPT-6 Astra assessora sob consulta. No Claude Code, Sonnet 5.5 conduz e implementa; Haiku 5.5 pesquisa; Opus 5.5 atua como advisor. Até duas pesquisas independentes simultâneas inicialmente. Uma ferramenta edita o lote por vez; o principal integra e verifica. Revisão cruzada começa somente leitura. Regras compartilhadas em Regras_de_desenvolvimento.md, estado em Passagem_de_trabalho.md e comandos/prompts em Guia_para_agentes.md. Configuração local e acesso aos modelos ainda precisam ser comprovados.

Design system pequeno em código, validado nas primeiras telas. Mocks de mapas/rotas identificados como demonstração. Supabase Auth gera e valida o OTP; Resend entrega o e-mail por SMTP. O agente não deve implementar um sistema independente de geração de códigos só para usar o SDK Resend. Manter sessão no aparelho é recomendação técnica, sem mudar o método de autenticação.

## Propostas que ainda precisam de validação

| Proposta | Situação |
|---|---|

## Pendências por momento de decisão

| Quando resolver | Pendência | O que pode avançar enquanto isso |
|---|---|---|
| Antes do login real | Projeto Supabase, URL, chave pública, remetente e domínio verificado no Resend | Design system, tela de e-mail/código e testes locais sem envio |
| Antes de fechar cadastro | Idade mínima, retirada definitiva do CPF, necessidade de telefone não verificado, foto obrigatória e visibilidade após aceite | Componentes e schemas com campos pendentes isolados |
| Antes da busca geográfica real | Pontos acessíveis/públicos, fornecedor e cobertura de rotas, desvio máximo do carro; 400 m iniciais ajustáveis já confirmados | Busca por horário e capacidade, contratos de adaptadores e mocks |
| Antes das migrations definitivas de convites | Comportamento de solicitações recebidas simultaneamente e criação de intenção durante uma negociação | Contratos e regras de exclusividade para revisão |
| Antes da inclusão de terceiro | Momento da busca, reconfirmação, falha da tentativa e cancelamento de integrante | Fluxo de duas pessoas e estrutura extensível de participantes |
| Antes das avaliações | Reciprocidade por par, contagem pública, notas ocultas, acompanhantes, ausência e relatos divergentes | UI de feedback, denúncia/bloqueio e contratos |
| Antes de usuários reais | Moderação, suporte, retenção de chat/locais, cancelamentos, privacidade, recuperação de conta e restauração de dados | Testes com dados fictícios |
| Antes de ativar serviço com billing ou publicar | Limite numérico de gastos, quotas, gastos únicos, contas das lojas e requisitos de distribuição | Implementação local com serviços simulados |

Perguntas de produto devem vir com contexto e exemplos curtos. Agrupar só as decisões da próxima etapa, em vez de interromper o trabalho por pendências que ainda não afetam a entrega. Registrar respostas aqui e ajustar os requisitos quando necessário.

## Como atualizar

Quando uma proposta for confirmada, mover para decisões, anotar data e atualizar os documentos afetados. Manter histórico curto de mudanças de regra. Não marcar uma tela ou funcionalidade como aprovada apenas porque existe imagem, código ou teste.

## Mapa real solicitado em 11 de outubro de 2026

O idealizador pediu tornar o mapa funcional. Implementado OpenStreetMap/Leaflet local, com navegação/zoom, pins A/B selecionáveis por toque/arraste e GPS acionado pelo usuário. Sem conta, chave, assinatura ou billing. Essa autorização substitui o recorte anterior de mapa apenas ilustrativo; companhias, roteamento, caminhadas e negociação permanecem demo. Validação em navegador/aparelho continua necessária.

Refinamento do mesmo dia: substituir botões de origem/destino por dois campos empilhados, inspirados na Uber, preenchidos por rua/bairro. Removido o editor de latitude/longitude. Implementadas sugestões e identificação reversa com Photon público para teste moderado, sem SLA, conta, chave ou cobrança. Selecionar uma sugestão confirma nome e ponto juntos; editar o texto invalida o ponto. GPS continua explícito e mapa continua alternativa. Fornecedor/cobertura de rotas e uso amplo do geocoder ainda precisam ser resolvidos. Políticas, dados enviados ao serviço e limitações em [mobile/README.md](../mobile/README.md).

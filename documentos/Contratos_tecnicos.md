# Divide aí — contratos técnicos propostos

Versão 1 • 8 de outubro de 2026.

Este documento propõe a implementação das regras em [Divide_ai_requisitos.md](Divide_ai_requisitos.md). Nomes de tabelas, funções e estados são sugestões técnicas, não uma API já implementada. Pendências de produto continuam em [Decisoes_e_pendencias.md](Decisoes_e_pendencias.md). O agente principal pode ajustar a estrutura preservando as regras confirmadas.

## Limites da arquitetura

Um aplicativo Expo e um projeto Supabase são suficientes como base. PostgreSQL concentra persistência, integridade e transações; Auth concentra autenticação; Storage armazena arquivos; Realtime transmite mudanças autorizadas; funções no servidor atendem integrações externas. Não criar servidor separado ou microserviços sem necessidade concreta.

O aparelho apresenta dados e envia comandos. O servidor decide compatibilidade, capacidade, validade, acesso e confirmação. Realtime e push avisam sobre mudanças; o app consulta novamente o estado quando abre ou reconecta. Nenhum aviso substitui a transação no banco.

## Modelo inicial

| Entidade sugerida | Conteúdo e responsabilidade |
|---|---|
| auth.users | Identidade gerenciada pelo Supabase Auth; não duplicar senhas ou códigos |
| profiles | Nome e campos de cadastro aprovados; separar projeção pública de dados privados |
| travel_intents | Dono, origem/destino privados, horário original, fuso, flexibilidade, passageiros e limites individuais de caminhada |
| company_requests | Solicitante, destinatário, intenções envolvidas, estado e revisão |
| negotiations / participants | Participantes, intenção de origem, passageiros de cada conta e situação da participação |
| proposal_versions | Versões imutáveis dos pontos, paradas ordenadas, horário e rateio; negociação aponta para a versão atual |
| proposal_confirmations | Participante e versão confirmada; unicidade por participante/versão |
| chat_messages | Negociação, autor, conteúdo e data; acesso só aos participantes autorizados |
| blocks / reports | Bloqueio por usuário e denúncia com acesso restrito à moderação |
| device_tokens / notification_outbox | Dispositivos e eventos de notificação a entregar após a transação |
| operation_receipts | Identificador idempotente e resultado dos comandos que precisam tolerar repetição |

Avaliações e relatos de realização exigem contratos adicionais após resolver as pendências. Entrada de terceira conta está fora do MVP; as referências a esse fluxo neste documento são futuras e dependem de nova autorização. O MVP usa duplas de contas com até três pessoas contando acompanhantes. Não publicar um schema definitivo que transforme hipóteses desses fluxos em regras. Fotos devem ficar em armazenamento privado com acesso autorizado; ocultar na interface não protege um arquivo com URL pública.

Separar dados privados de projeções de descoberta. Não retornar endereço exato, coordenadas privadas, foto ou dados pessoais para o cliente antes do aceite mútuo. RLS restringe linhas; usar tabelas/projeções e funções adequadas também para restringir campos. Após aceite, liberar apenas os detalhes autorizados pela política que ainda será definida.

## Disponibilidade e expiração

Guardar instantes em UTC e o fuso IANA usado na entrada. Comparar intervalos da mesma data/instante; não comparar somente strings como “18:00”. Flexível: [horário − 15 min, horário + 15 min]; fixo: [horário, horário]. Há compatibilidade quando o maior início não supera o menor fim. A proposta escolhe um instante nessa interseção.

A intenção expira no instante originalmente escolhido. Uma solicitação precisa das duas intenções ainda válidas: tecnicamente seu prazo não pode ultrapassar o menor dos dois horários originais. Sem timeout adicional de alguns minutos. Validar isso dentro de cada operação; a tarefa agendada apenas materializa o estado e os avisos, podendo rodar depois do prazo sem permitir aceites atrasados.

Negociação após aceite mútuo não recebe um prazo novo inventado. Viagem combinada não expira junto da busca. Inatividade da negociação e inclusão tardia de terceiro permanecem pendentes.

## Estados e transições

| Objeto | Estados sugeridos | Transição principal |
|---|---|---|
| Intenção | active, paused, expired, closed | Negociação retira da descoberta; cancelamento pode permitir retomar somente se ainda válida |
| Solicitação | pending, matched, cancelled, declined, expired | Interesse do outro lado produz aceite mútuo e abre negociação |
| Negociação | negotiating, agreed, ended | Todos confirmam a versão atual para formar acordo |
| Proposta | número de versão, sem editar versões antigas | Alteração cria nova versão; confirmações antigas deixam de valer |

Uma solicitação recebida não deve automaticamente impedir o destinatário de explorar ou enviar interesse; a política para várias solicitações recebidas precisa ser fechada antes do schema definitivo. Garantir desde já uma única solicitação de saída pendente por usuário e participação exclusiva após o aceite mútuo. A restrição de entrada de terceiro não deve ser contornada criando outra negociação independente.

“Carona reservada” é texto aprovado de um estudo visual. O estado significa acordo entre passageiros, sem reserva de veículo no Uber/99. O estudo não autoriza trocar um acordo confirmado pelo modal de troca de solicitação pendente.

## Comandos sugeridos

Todas as operações usam identidade autenticada, validam a participação e retornam o estado atualizado. Nomes abaixo descrevem intenção, sem fixar assinatura SQL ou HTTP.

| Comando | Validações e resultado |
|---|---|
| create_or_update_intent | Campos, horário, capacidade e restrições; edição não altera silenciosamente um acordo existente |
| discover_candidates | Horário, passageiros, bloqueios e elegibilidade; projeção sem dados privados; geografia conforme modo real/demo |
| request_company | Intenções válidas, exclusividade e compatibilidade; registrar interesse ou abrir negociação se houver aceite mútuo |
| replace_pending_request | ID/revisão esperados do pedido anterior, candidato elegível e ausência de negociação; cancelar e criar em uma transação |
| cancel_pending_request | Dono e estado esperado; não cancelar negociação usando comando de pedido pendente |
| accept_company | Intenções válidas; criar participação exclusiva de forma atômica e encerrar pedidos conflitantes |
| update_proposal | Participação, revisão esperada, horário comum e limites; criar versão e reiniciar confirmações |
| confirm_proposal | Versão atual, capacidade e elegibilidade; concluir acordo somente com todos confirmando a mesma versão |
| send_message | Participação autorizada e limites de conteúdo; chat apenas após aceite mútuo |
| end_participation | Aplicar regra de cancelamento correspondente; grupos de três aguardam política definida |

A substituição de pedido falha por inteiro se o candidato sair, o prazo vencer ou houver aceite concorrente. Nesse caso preservar o pedido anterior se ele ainda estiver pendente; se virou negociação, retornar esse estado e atualizar a tela. Nunca desfazer um aceite mútuo por uma confirmação antiga de modal.

## Concorrência e falhas

Usar transações e bloqueios consistentes dos participantes/intenções afetados, em ordem estável, apoiados por constraints de unicidade. Revalidar condições após adquirir os bloqueios. Atualizações de proposta usam versão esperada; comando de confirmação atrasado retorna conflito em vez de aceitar outro resumo.

Comandos críticos recebem identificador idempotente vinculado ao usuário e à operação. Repetir após perda de conexão retorna o mesmo resultado sem duplicar pedido, mensagem ou notificação. Associar o identificador a um payload consistente. O cliente não mostra confirmação definitiva antes da resposta do servidor.

Produzir eventos de notificação na mesma transação; um consumidor entrega depois do commit, com deduplicação e repetição controlada. Não enviar push para uma troca que foi revertida. Reconexão recupera o estado atual independentemente de eventos perdidos.

## Geografia e limites de custo

Definir interfaces para pesquisar locais, gerar candidatos a pontos e medir rotas a pé/de carro. Implementar primeiro adaptadores demo explícitos com dados fictícios, sem chave de API ou chamadas faturáveis. Distância em linha reta serve no máximo como filtro inicial de candidatos; nunca como comprovação de caminhada elegível.

Modo real exige rotas de caminhada e pontos concretos adequados, ou cobertura previamente validada e explicitamente limitada. Ausência de rota, cobertura ou quota retorna indisponibilidade; não converter estimativa em distância real. Filtrar no banco por horário/capacidade e região antes de consultar rotas. Cache só conforme condições do fornecedor, dados utilizados e prazo de validade.

Chamadas faturáveis ficam no servidor com quotas por usuário e globais. Restringir chaves do SDK nativo ao aplicativo e não reutilizar segredo de servidor no pacote. O fornecedor final, as quotas e o teto monetário ainda precisam de validação antes do piloto real.

## Autenticação e segredos

Supabase Auth gera e valida os códigos; Resend entrega por SMTP com template de código de e-mail. Manter sessão no aparelho usando armazenamento apropriado. OTP válido por 10 minutos e reenvio após 60 segundos são decisões confirmadas; limites de tentativa e configuração efetiva ainda precisam de validação. Nenhum envio real foi realizado nesta fase.

O aplicativo usa somente URL e chave pública apropriada do Supabase, sempre com autorização no banco. Chaves privilegiadas, Resend e segredos externos ficam exclusivamente no servidor/configuração SMTP. Não copiar a credencial de .env.server.local para código, logs, prompts ou migrations. O domínio informado é divideai.com e o remetente confirmado é Divide aí <acesso@divideai.com>; DNS e entrega ainda não foram verificados.

## Evidências antes da integração

Testar contratos de horário, limites de capacidade e estados; no banco testar RLS com usuários distintos, troca atômica, aceites simultâneos, repetição idempotente e confirmação de versão antiga. Testar também prazo vencido mesmo sem tarefa agendada, notificação somente após commit e ausência de dados privados na descoberta. Critérios e sequência estão no [Roteiro_de_implementacao.md](Roteiro_de_implementacao.md).

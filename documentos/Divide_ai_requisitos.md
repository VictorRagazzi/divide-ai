# Divide aí levantamento de requisitos

Versão 2 • 8 de outubro de 2026

## Visão do produto e escopo

### Objetivo

O Divide aí, nome provisório, conecta pessoas com origem, destino e horário de embarque compatíveis para compartilhar uma corrida solicitada em um aplicativo de transporte. O benefício esperado é reduzir o custo com pouca alteração na experiência individual.

### Uso deste documento

Este levantamento orienta o desenho das telas e o planejamento da primeira versão. Decisões confirmadas na conversa são requisitos; propostas e lacunas estão identificadas como pendentes. A direção técnica discutida está registrada em [Plano_de_desenvolvimento.md](Plano_de_desenvolvimento.md). O teto de orçamento, o cronograma e fornecedores pendentes ainda precisam ser definidos. Versão 2, atualizada em 8 de outubro de 2026.

### Escopo confirmado

- Cadastro e perfil; registro de intenção de viagem imediata ou futura; busca contínua de pessoas compatíveis; aceite mútuo; proposta de trajeto e chat; confirmação de um resumo comum; duplas de contas com até três passageiros contando acompanhantes; cancelamento; notificações; avaliação, denúncia e bloqueio. Inclusão de terceira conta fica fora do MVP.
- Na primeira versão, o Divide aí organiza o encontro. Uma pessoa solicita o carro no Uber, 99 ou outro serviço por fora. Não há solicitação integrada, cobrança integrada, garantia de repasse ou acompanhamento automático da corrida.

### Fora da primeira versão

- IA para comparar o chat com a proposta; divisão proporcional por distância; múltiplas negociações simultâneas; modalidades como rodízios e outros descontos em grupo.
- Integrações de transporte e pagamento serão investigadas futuramente. Documentação de API não garante acesso comercial nem divisão da cobrança entre passageiros.

### Público e piloto

O uso pode ser imediato ou planejado. Um congresso acadêmico é a hipótese de piloto indicada pelo idealizador, ainda sem evento escolhido. A concentração da divulgação é uma estratégia de teste; o aplicativo não precisa ficar restrito ao evento.

### Vocabulário

Intenção é o pedido de encontrar companhia. Aceite de perfil indica interesse em dividir. Proposta é uma configuração de embarque, desembarque, horário e paradas. Viagem combinada é a proposta confirmada por todos. Ela não significa que um carro já foi solicitado ou que a corrida começou.

## Cadastro e descoberta de pessoas

### RF01 Cadastro e perfil

Dados inicialmente previstos: nome, telefone, data de nascimento e foto. O CPF foi questionado e tende a sair do escopo, mas sua exclusão definitiva precisa ser confirmada. A autenticação inicial será sem senha, por OTP enviado ao e-mail; o e-mail integra o cadastro. Verificação por telefone via SMS/WhatsApp fica para uma fase futura. OTP no e-mail não verifica telefone nem identidade civil. A necessidade de coletar telefone no perfil continua a definir. E-mail, telefone, data de nascimento e eventual CPF não devem ser mostrados a outros passageiros.

### RF02 Intenção de viagem

Informar origem desejada, destino desejado, data, horário previsto de embarque e quantidade de passageiros vinculados ao usuário. A quantidade inclui o próprio usuário e seus acompanhantes. O total do grupo deve ser de até três passageiros, mesmo que sejam apenas duas contas.

### RF03 Horário

O cadastro usa um horário único e a opção “Preciso sair nesse horário”. Desmarcada, a disponibilidade vai de 15 minutos antes até 15 minutos depois do horário escolhido. Marcada, o horário é fixo: não se antecipa nem se atrasa.

A compatibilidade depende da interseção das disponibilidades, incluindo os extremos. Não existe um limite adicional de 15 minutos entre os horários informados. Exemplo: 18h flexível e 18h30 flexível são compatíveis às 18h15. Uma pessoa com horário fixo só combina se esse horário estiver na janela da outra; dois horários fixos diferentes são incompatíveis. A proposta deve usar um horário comum a todos.

O cartão sinaliza quando a companhia precisa sair em horário fixo e mostra o horário ou intervalo compatível. O app não garante a chegada do motorista.

### RF04 Proximidade

A distância representa a caminhada real da pessoa até o ponto de embarque e, separadamente, do ponto de desembarque até seu destino final. Deve considerar caminhos a pé, travessias e acessos; distância em linha reta não basta. O limite de cada participante precisa ser respeitado nos dois extremos, separadamente, e não como a soma das caminhadas.

Não medir apenas a distância entre as origens ou entre os destinos dos usuários. Duas origens a 800 m podem ter um ponto intermediário acessível a 400 m de caminhada de cada pessoa. O ponto concreto precisa ser adequado ao encontro.

O limite inicial confirmado é de 400 metros, ajustável e aplicado separadamente em cada extremo. Seleção de pontos públicos, fornecedor de rotas e desvio máximo do carro permanecem pendentes.

### RF05 Busca contínua

A busca verifica intenções existentes e novas intenções enquanto estiver ativa, para viagens imediatas ou futuras. Notificar quando houver uma combinação acionável.

A busca e as solicitações pendentes encerram automaticamente no horário originalmente escolhido pelo usuário, mesmo quando ele permite flexibilidade. Não há um prazo adicional de resposta (por exemplo, alguns minutos). A margem de 15 minutos serve à combinação do embarque e não prolonga a validade da busca.

Exemplo: uma pessoa que escolheu 18h pode confirmar antes desse prazo uma viagem para 18h15. Às 18h sua busca e solicitações ainda pendentes são encerradas. Uma viagem já confirmada continua válida, com acesso ao acordo e ao chat.

### RF06 Cartão antes do aceite

- Exibir nome, nota e número de viagens; quantidade de passageiros; data e horário desejado; horário ou intervalo compatível e indicação de horário fixo quando aplicável; caminhada aproximada até o embarque e do desembarque até o destino; regra de divisão igual por passageiro.
- Exemplo de caminhada: “300 m a pé da sua origem até o embarque” e “200 m a pé do desembarque até seu destino”. Não apresentar esses valores como distância até a origem privada da outra pessoa.
- Não mostrar foto, endereço exato nem localização identificável da outra pessoa antes do aceite mútuo. Região aproximada ou ponto público sugerido pode ser usado sem expor a origem privada.
- Arrastar à esquerda ou tocar em “Pular” mostra a próxima sugestão disponível. Arrastar à direita ou tocar em “Aceitar” demonstra interesse; não confirma a viagem.
- Pular não é bloquear nem cancelar um compromisso. A sugestão sai da sequência da sessão e pode reaparecer ao reabrir o app se continuar disponível, compatível e não bloqueada. Microtexto: “Pulou? A sugestão pode reaparecer ao abrir o app novamente.”
- Se acabarem as sugestões, informar que a busca continua. “Rever sugestões puladas” é um atalho de UX para reconsiderar sem precisar reiniciar.

### RF07 Uma negociação por vez

O usuário pode continuar visualizando e pulando sugestões enquanto aguarda a resposta de uma companhia. Mantém apenas uma solicitação pendente por vez. Visualizar outro cartão não cancela a solicitação atual.

Ao tentar aceitar outra pessoa, abrir um modal de confirmação antes de alterar qualquer solicitação. Identificar explicitamente quem será cancelado e quem receberá a nova solicitação. Exemplo:

> Trocar de companhia? Você está aguardando Evandro. Para aceitar Bruno, sua solicitação anterior será cancelada. A viagem ainda não estará confirmada; Bruno também precisa aceitar.
>
> Ações: “Cancelar com Evandro e aceitar Bruno” e “Manter solicitação com Evandro”.

Fechar o modal mantém a solicitação anterior. Confirmar troca a solicitação: a anterior deixa de valer e a nova fica pendente. Mostrar confirmação com os dois nomes. No backend, fazer essa troca em uma operação atômica: se a nova solicitação não puder ser registrada, preservar a anterior.

Se o aceite mútuo ocorrer enquanto o modal estiver aberto, atualizar a tela e informar que já existe uma negociação. Não cancelar silenciosamente por um modal referente a uma solicitação pendente. A partir do aceite mútuo, a negociação é exclusiva; o usuário precisa encerrar sua participação antes de iniciar outra.

A tela de espera oferece “Continuar vendo sugestões” e “Cancelar solicitação e buscar outra”. O tratamento de eventos simultâneos deve garantir que só uma solicitação ou negociação fique ativa.

## Aceite e acordo sobre a viagem

### RF08 Duas etapas de confirmação

Primeiro, todos os envolvidos aceitam a companhia. Depois do aceite mútuo, o app apresenta os detalhes necessários da viagem e abre um pequeno chat. A segunda confirmação é sobre uma proposta concreta; interesse em dividir não constitui compromisso com um trajeto.

### RF09 Comparação e sugestão

Apresentar os dados de A, os de B e a sugestão do aplicativo, comparando local de embarque, local de desembarque e horário. Em telas pequenas, a tabela pode virar cartões equivalentes. A “média” apresentada na conversa era apenas ilustrativa: o ponto deve ser concreto, acessível e adequado ao encontro, respeitando as restrições de horário.

### RF10 Atalhos de proposta

- Usar a sugestão do app.
- Usar todo o trajeto de A.
- Usar todo o trajeto de B.
- Adicionar parada de embarque ou desembarque. Informar o local e a sequência necessária.

### RF11 Escolhas diferentes

Os atalhos preenchem propostas; não elegem automaticamente uma opção vencedora. Há seis pares divergentes entre as quatro alternativas, ignorando a ordem das pessoas, e dez combinações com repetição. O comportamento é comum: mostrar a divergência, permitir conversar e ajustar, e exigir confirmação do mesmo resumo.

### RF12 Resumo como referência

O resumo reúne embarque, desembarque, horário previsto de embarque, paradas e divisão dos custos. Os dois podem ajustar os detalhes acordados no chat. A confirmação refere-se à mesma versão do resumo. Alterar um detalhe exige nova confirmação dos demais. “Adicionar parada” é uma ação: marcar esse botão dos dois lados não prova que ambos querem a mesma parada.

### RF13 Chat

O chat serve para negociar e combinar detalhes práticos. Endereços necessários ao acordo podem ser compartilhados após o aceite; a exposição de foto, contato e endereços originais completos nessa fase ainda precisa ser definida. Na primeira versão, o conteúdo do chat não é analisado por IA.

### RF14 Viagem combinada

Quando todos confirmam o mesmo resumo, exibir “Viagem combinada”. Não chamar esse estado de “Corrida iniciada”. A responsabilidade de solicitar o carro e a forma de repasse são acertadas entre os passageiros pelo chat; não exigir um responsável no formulário foi a preferência mais recente do idealizador.

## Terceiro passageiro e divisão de custos

Decisão de 8 de outubro de 2026: o MVP trabalha com duplas de contas, sem busca ou inclusão de uma terceira conta. O limite de três passageiros contando acompanhantes permanece. RF16, RF17, a simplificação e os exemplos de inclusão de C abaixo são referências futuras, fora do MVP; não implementar nesta fase.

### RF15 Capacidade

A capacidade é de três pessoas, contando acompanhantes. Uma conta com dois passageiros e outra com um passageiro já preenchem a viagem. Não confundir três passageiros com três usuários cadastrados.

### RF16 Nova busca do grupo

Após combinar uma viagem, usar os pontos e o horário atualizados como base para novas sugestões se houver vaga. C, cadastrado durante a espera por B, pode ser encontrado nessa nova verificação. A e B devem participar do aceite da nova companhia; C aceita entrar no grupo.

### Momento da verificação

O idealizador sugeriu disparar a verificação ao B aceitar. A proposta mais recente é dispará-la após A e B confirmarem os detalhes, pois já existe um trajeto definido. O momento exato ainda não foi confirmado. Também foi proposto verificar novas intenções enquanto houver vaga e tempo para negociação.

### RF17 Entrada sem imposição

Não inserir um terceiro sem concordância do grupo. Se a entrada mudar embarque, desembarque, horário ou paradas, todos devem concordar com o resumo atualizado. O idealizador considera refazer a negociação melhor do que impor uma pessoa, mas ainda avalia o esforço dessa etapa.

### Simplificação proposta

Preservar a viagem existente como proposta inicial. Se C aceitar todos os detalhes existentes, confirmar apenas sua entrada; se houver mudanças, reconfirmar o resumo com todos. Se a tentativa falhar, manter o acordo de A e B. Essa simplificação foi recomendada e ainda precisa de aceite explícito.

### RF18 Divisão igual

O app estabelece a regra para evitar negociação ambígua: dois passageiros pagam metade cada; três passageiros pagam um terço cada. Um usuário com acompanhante fica responsável por duas partes. A regra aparece antes da confirmação final. Não foi definida cobrança pelo próprio Divide aí.

### Limites financeiros

O valor real e o repasse são acertados por fora. Não afirmar que o app sabe o preço final, recebeu o pagamento ou garantiu economia. Cupons, pedágios, taxas, cancelamentos do serviço de transporte e arredondamentos precisam de regra caso passem a ser calculados pelo app.

### Exemplos para o protótipo

- A sozinho e B sozinho: duas vagas ocupadas, divisão 50% para cada, possibilidade de buscar C.
- A com acompanhante e B sozinho: três vagas ocupadas, A responde por dois terços e B por um terço.
- C propõe uma parada: o grupo vê a alteração antes de confirmar sua inclusão.

## Cancelamento confiança e avaliações

### RF19 Cancelamento

O passageiro pode desistir sem multa prevista no Divide aí. Encerrar sua participação, notificar os afetados e oferecer continuidade da busca. Recusar um perfil não conta como desistência. Cancelamentos após confirmar o acordo podem compor um indicador de frequência no perfil; período, mínimo de casos e tratamento de motivos permanecem pendentes.

### RF20 Lembrete após a viagem

Enviar push após o horário estimado de conclusão. A mensagem pode convidar ao feedback, mas deve perguntar se a viagem aconteceu antes de avaliar. Estimar usando duração de trajeto quando disponível; cinco quilômetros não equivalem sempre a vinte minutos. O push não comprova conclusão.

### RF21 Avaliação por passageiro

Cada usuário avalia os outros participantes com nota em estrelas. Para notas abaixo de três estrelas, exigir feedback explicativo. Mostrar a nota agregada acompanhada do número de viagens. Usuário novo deve aparecer como sem avaliações, sem receber nota inventada.

### RF22 Revelação recíproca

Uma pessoa só pode visualizar a avaliação recebida depois de também avaliar. Não aplicar a alternativa de revelar automaticamente após um prazo: ela não corresponde à intenção do idealizador. Para três contas, foi proposta aplicação por par: A vê a avaliação de B depois de avaliar B, independentemente de C. A regra por par ainda precisa de confirmação explícita.

### RF23 Denúncia e bloqueio

Denunciar e bloquear deve ser possível independentemente da troca de avaliações. Feedback baixo pode apoiar análise de restrição ou banimento, mas a nota isolada não deve causar banimento automático. Critérios de moderação, motivos e contestação não foram definidos.

### RF24 Viagem não realizada

Permitir relatar que a viagem não aconteceu, incluindo cancelamento ou ausência. Não tratar uma corrida não realizada como experiência concluída. Quem pode avaliar uma ausência, como contabilizar viagens e como resolver relatos divergentes são pendências.

### Avaliações e privacidade

Ainda definir se uma avaliação oculta ao destinatário afeta imediatamente a nota pública, quem pode ver o comentário e como tratar acompanhantes sem conta. Definir também retenção do chat e dos locais. Esses pontos não devem ser presumidos no design como decisões fechadas.

## Pendências e critérios para o desenho

### Decisões necessárias

- Geografia: 400 m iniciais ajustáveis confirmados; definir desvio máximo do carro, seleção de pontos públicos e fornecedor de rotas a pé. Comparação de C com grupo formado fica para uma fase futura, fora do MVP.
- Prazos: definir inatividade após aceite mútuo e limite para incluir passageiro perto do embarque. Busca e solicitações pendentes já têm encerramento no horário originalmente escolhido.
- Cadastro: confirmar exclusão do CPF, necessidade de telefone não verificado, idade mínima e visibilidade da foto depois do aceite. Login por OTP no e-mail definido; recuperação e troca de e-mail a especificar.
- Grupo: confirmar gatilho de busca de C, simplificação de entrada e tratamento do cancelamento de um integrante.
- Avaliação: confirmar desbloqueio por par, número de viagens, notas públicas, acompanhantes, ausências e disputas.
- Operação: política de moderação, privacidade, suporte e fornecedores de mapas, rotas e notificações.
- Produto: teto mensal de gastos, evento piloto e métricas de sucesso. O orçamento vem dos recursos pessoais limitados do idealizador. A base foi aprovada: React Native + Expo + TypeScript, Tamagui, Biome, design system inicial e Supabase/PostgreSQL. Android será o piloto, com iOS depois. A prioridade é o menor custo possível; faltam um teto numérico, configuração/verificação da integração de e-mail e validação da integração futura de mapas. Consultar [Plano_de_desenvolvimento.md](Plano_de_desenvolvimento.md) para as preferências, recomendações complementares e pendências.

### Estados a representar

Busca ativa sem sugestão; sugestão disponível; solicitação pendente durante exploração; modal de troca; sugestões esgotadas; busca encerrada no horário escolhido; aguardando aceite; negociação com chat; proposta aguardando confirmações; proposta alterada; viagem combinada com vaga; convite ao terceiro; grupo completo; tentativa recusada ou expirada; cancelamento; lembrete de conclusão; viagem não realizada; avaliação enviada; avaliação recebida oculta; avaliação liberada; denúncia e bloqueio.

### Critérios essenciais de aceitação

- Antes do aceite mútuo, o cartão não revela foto nem endereço exato.
- Um usuário com negociação ativa não inicia uma negociação paralela.
- O horário proposto pertence à interseção das disponibilidades de todos; horário fixo deve ser respeitado exatamente.
- 18h flexível e 18h30 flexível podem combinar às 18h15.
- As caminhadas de embarque e desembarque respeitam separadamente o limite de cada pessoa.
- Busca e solicitações pendentes encerram no horário originalmente escolhido, sem estender os 15 minutos.
- Explorar sugestões mantém a solicitação anterior; aceitar outra exige confirmar uma troca explícita.
- Falha na troca preserva a solicitação anterior; aceite mútuo concorrente impede cancelamento silencioso.
- Sugestões puladas só reaparecem se ainda elegíveis; bloqueados não reaparecem.
- A soma de usuários e acompanhantes nunca excede três passageiros.
- O acordo exige confirmação de todos sobre a mesma versão dos detalhes.
- Uma alteração não preserva confirmações dadas a uma versão anterior.
- Em uma fase futura fora do MVP, a inclusão de C depende do consentimento de todos e da capacidade disponível.
- O app mostra a regra de divisão igual e não afirma ter solicitado ou cobrado uma corrida.
- A avaliação recebida permanece oculta enquanto o destinatário não cumprir a reciprocidade definida.
- Denunciar e bloquear não depende de avaliar ou de receber uma avaliação.

### Direção para as telas

Priorizar poucos passos, linguagem clara em português brasileiro e fluxo móvel. Usar o chat junto à proposta sem permitir que informações essenciais fiquem apenas nas mensagens. Separar buscar companhia, combinar viagem e solicitar carro por fora. Começar com fluxos e wireframes antes de escolher uma identidade visual definitiva.

### Referências de integração

Consulta realizada em 3 de outubro de 2026. Uber Riders API: https://developer.uber.com/docs/riders/introduction. API da 99 para Empresas: https://99app.com/ajuda/empresas/para-que-serve/. Integrações dependem de acesso e adequação comercial; não são dependências da primeira versão.

## Revisão de telas — 8 de outubro de 2026

Telas 02, 03 e 04 revisadas no protótipo HTML e nas imagens de telas. Preservar a paleta e o conceito de cards; priorizar clareza e liberdade para reorganizar o visual. O modal de troca é um estado da tela 03. As demais telas continuam como referências sujeitas a revisão, sem aprovação global. A opção de horário na tela 01 teve apenas o texto e a explicação alinhados às regras atuais.

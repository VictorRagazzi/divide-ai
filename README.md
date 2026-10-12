# Divide aí — planejamento e protótipo

Abra `Divide-ai-MVP.html` no navegador. O arquivo funciona localmente e reúne 20 telas; use o inventário lateral para visitar cada uma. Os botões conectam as principais etapas, e os controles identificados como simulação representam respostas de outras pessoas.

Figma parcial: https://www.figma.com/design/WzdWe2X45yaB9hcEVuwvti — sete telas nativas e componentes. A criação foi interrompida pelo limite de chamadas do plano Starter; o protótipo HTML contém a sequência restante.

Referência de experiência: https://www.uber.com/us/en/ride/how-it-works/ . Hierarquia de trajeto, títulos fortes e ações diretas, adaptadas ao objetivo de encontrar companhia.

Hipóteses de design: foto e telefone ocultos após o aceite; busca de C após a dupla combinar; tentativa frustrada de incluir C preserva a dupla; todos reconfirmam o resumo e a divisão. Nenhuma dessas hipóteses fecha as pendências do levantamento.

Sem backend ou integração. Mensagens, confirmações e relatos são demonstrações locais. Endereços, distâncias e avaliações são fictícios. A compatibilidade de horário é demonstrada localmente; não são calculados compatibilidade geográfica real, preço, horário de conclusão ou rota. A tela de ausência não habilita avaliação de viagem concluída. A avaliação recíproca do grupo de três permanece pendente.

O formulário permite editar dados de intenção e contagem de passageiros, mas a navegação lateral também permite inspecionar cenários independentes, que não formam uma sessão operacional completa. Políticas de CPF, idade mínima, telefone, seleção de pontos, limite inicial de caminhada, moderação, cancelamento de grupo e retenção ainda precisam ser definidas.

## Atualizações do protótipo — 8 de outubro de 2026

Telas 02, 03 e 04 reorganizadas para facilitar leitura e decisão, preservando a paleta e o conceito de cards. A tela 01 mantém seu visual; seu seletor de horário agora explica a flexibilidade de ±15 minutos e a opção “Preciso sair nesse horário”. Outras telas ainda são referências a revisar, não telas aprovadas.

- **02 · Busca ativa:** trajeto, disponibilidade, passageiros, explicação das caminhadas e encerramento no horário escolhido.
- **03 · Companhia sugerida:** perfis de exemplo, horário compatível, indicação de horário fixo, caminhada de cada extremo, divisão igual e navegação por gesto ou botão. Pular avança para a próxima sugestão; a lista esgotada permite rever as puladas.
- **04 · Aguardando aceite:** mantém o pedido enquanto o usuário continua explorando. Aceitar outra pessoa abre um modal que identifica a solicitação cancelada e a nova. Fechar mantém a anterior; confirmar troca. O caso de aceite mútuo durante a troca interrompe o modal e abre o estado de companhia aceita.

O protótipo calcula a interseção das janelas para três perfis locais; distâncias, disponibilidade e respostas continuam fictícias. Bruno exemplifica 18h30 flexível compatível com 18h flexível às 18h15; Camila exemplifica horário fixo. Reiniciar o fluxo permite rever sugestões. Estado de sessão em memória, sem persistência nem backend.

Os controles externos “Simular aceite recebido” e “Simular horário de encerramento” são apenas de demonstração. A expiração usa um cenário manual, não um relógio real. A troca local é imediata; atomicidade, concorrência entre dispositivos, persistência, elegibilidade real e notificações precisam ser implementadas no backend.

A pasta telas contém as imagens do protótipo. As imagens 02, 03 e 04 foram substituídas por esta revisão. A subpasta telas/estados inclui exploração com pedido pendente, modal de troca, horário fixo, lista esgotada e busca encerrada. Imagens das outras telas e arquivos soltos na raiz são registros anteriores. O HTML é a referência navegável atual; o Figma permanece parcial e não foi sincronizado nesta revisão.

A pasta documentos reúne requisitos e briefing atualizados. Foram confirmados: compatibilidade pela interseção de ±15 minutos (ou horário fixo), caminhada nos dois extremos, expiração no horário original e uma solicitação por vez com navegação livre e confirmação de troca.

### Variação da tela 03 — carona reservada

A tela normal e a variação tiveram removidos os textos de flexibilidade de ±15 minutos, aviso de foto/endereços ocultos e instruções textuais de arrastar à esquerda/direita. Os botões Pular e Aceitar, o intervalo compatível e a sinalização de horário fixo foram preservados. Essa limpeza visual não altera as regras de disponibilidade nem de privacidade.

Abra [Divide-ai-tela-03-reservada.html](Divide-ai-tela-03-reservada.html) para ver o estudo visual com o aviso verde “Você já tem uma carona reservada”, imediatamente abaixo do cabeçalho. A variação é uma referência visual, sem implementar troca ou nova solicitação após uma viagem já combinada. A navegação funcional permanece no protótipo principal. Imagens de comparação: telas/estados/03-Normal-sem-textos.jpg e telas/estados/03-Carona-reservada.jpg.

## Plano de desenvolvimento

O [plano de desenvolvimento](documentos/Plano_de_desenvolvimento.md) registra a base técnica aprovada, Tamagui, Biome, design system inicial, backend e sequência de implementação. A versão 5 inclui OTP por e-mail sem senha, Android primeiro, prioridade de custo mínimo, mapas demo inicialmente e integração futura sujeita à validação de custos. Existe um rascunho Expo não validado em mobile/, iniciado e interrompido durante a conversa. A instalação de dependências foi interrompida. Não há backend conectado nem aplicativo publicado.

## Desenvolvimento com Codex e Claude Code

Alternar as ferramentas por lote: Codex com Sol principal, Luna pesquisador e Astra assessor; Claude Code com Sonnet principal, Haiku pesquisador e Opus advisor. Uma ferramenta implementa o lote por vez; a outra pode revisar somente em leitura. As duas seguem [regras compartilhadas](documentos/Regras_de_desenvolvimento.md) e [passagem de trabalho](documentos/Passagem_de_trabalho.md).

Entradas: [AGENTS.md](AGENTS.md) para Codex e [CLAUDE.md](CLAUDE.md) para Claude. Comandos e prompts no [guia](documentos/Guia_para_agentes.md). No CLI Codex, executar [iniciar-codex.ps1](iniciar-codex.ps1) na raiz para configuração por sessão. No app, selecionar GPT-6.1 Sol e colar o prompt do guia. Configurações foram preparadas, mas sua execução local ainda não foi comprovada.

## Começar pelo planejamento

Leia [documentos/LEIA_PRIMEIRO.md](documentos/LEIA_PRIMEIRO.md) para decisões, arquitetura, contratos propostos, etapas e passagem de trabalho aos agentes. [Guia_para_agentes.md](documentos/Guia_para_agentes.md) inclui prompts para análise e implementação futura. O escopo atual é documentação; a próxima tarefa de implementação deverá ser iniciada explicitamente pelo idealizador.

Domínio informado: divideai.com. A credencial do Resend está em arquivo local ignorado pelo Git; os documentos não contêm seu valor. Remetente, DNS e envio real ainda precisam de verificação.

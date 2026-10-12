# Divide aí — desenvolvimento alternado com Codex e Claude Code

Versão 3 • 8 de outubro de 2026.

## Fontes compartilhadas

As duas ferramentas seguem [Regras_de_desenvolvimento.md](Regras_de_desenvolvimento.md) e [Passagem_de_trabalho.md](Passagem_de_trabalho.md). Leia depois [LEIA_PRIMEIRO.md](LEIA_PRIMEIRO.md) e siga a ordem. AGENTS.md é a entrada Codex; CLAUDE.md é a entrada Claude. A revisão atual prepara a próxima sessão, sem iniciar código do app.

## Arquiteturas

| Papel | Codex | Claude Code |
|---|---|---|
| Principal: planejar, implementar, integrar e verificar | GPT-6.1 Sol, medium | Sonnet 5.5 |
| Pesquisador: arquivos/documentação, somente leitura | GPT-6 Luna, high | Haiku 5.5 |
| Assessor: decisões importantes, falhas recorrentes e lacunas | GPT-6 Astra, low, como subagente sob consulta | Opus 5.5, como advisor |

O principal escreve o código de UI, domínio e backend. Os pesquisadores retornam evidências concisas. Começar com uma pesquisa; até duas independentes simultâneas quando úteis. Esperar liberar uma vaga antes de chamar o assessor se as duas pesquisas estiverem ativas. Consultas são pontuais e não substituem testes. Conferir os modelos efetivos; se indisponíveis, comunicar e seguir com o principal quando possível.

## Iniciar Codex no app ou IDE

Abra uma nova sessão neste diretório. Selecione GPT-6.1 Sol, esforço Medium quando disponível, e cole um dos prompts abaixo. AGENTS.md solicita delegação de pesquisas Luna e consultas Astra; os modelos/recursos efetivos dependem do cliente. As configurações dos papéis CLI não são automaticamente carregadas no app por este pacote. Quando o cliente permitir modelo por subagente, passar explicitamente Luna/high e Astra/low, com apenas o contexto necessário. Se não permitir, relatar a limitação e realizar a tarefa com o principal.

## Iniciar Codex CLI

Na raiz, em PowerShell:

```powershell
./iniciar-codex.ps1
```

O script passa configuração apenas para aquela sessão: Sol/medium, modelo padrão dos subagentes Luna/high, limite de dois auxiliares simultâneos e papéis pesquisador/assessor com arquivos TOML em documentos/agentes/codex. O assessor escolhe Astra/low. Não altera configuração global nem políticas de aprovação. Copiar o prompt desejado após iniciar.

Também aceita um prompt inicial:

```powershell
./iniciar-codex.ps1 -Prompt "Leia AGENTS.md e documentos/Passagem_de_trabalho.md. Faça a análise inicial somente leitura conforme o guia."
```

Configuração baseada na [referência oficial](https://learn.chatgpt.com/docs/config-file/config-reference) e nos [subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents). CLI precisa estar instalado e os modelos disponíveis na conta. O script e a configuração foram inspecionados, mas não executados nesta revisão: o terminal retornou falha de inicialização antes de qualquer comando. Não há instalação ou funcionamento local comprovados.

## Iniciar Claude Code

Na raiz, em PowerShell:

```powershell
$env:CLAUDE_CODE_SUBAGENT_MODEL = 'claude-haiku-5-5'
claude --model claude-sonnet-5-5 --advisor claude-opus-5-5
```

Usar variável documentada para os subagentes; o exemplo original com --subagents não aparece na referência oficial consultada. Configurações individuais podem escolher outro modelo; conferir o resultado efetivo. Advisor depende de suporte da instalação/conta e acrescenta consumo. Fontes: [CLI](https://code.claude.com/docs/en/cli-reference), [modelos](https://code.claude.com/docs/en/model-config), [advisor](https://code.claude.com/docs/en/advisor). Claude Code não foi instalado ou validado por esta revisão.

## Alternar e revisar

Concluir um lote ou registrar seu estado antes da troca. Atualizar Passagem_de_trabalho.md e garantir que uma única ferramenta edite o lote por vez. A nova sessão lê os arquivos e inspeciona o estado local, sem depender da conversa anterior. Registrar Git/branch/commit quando houver repositório; a revisão atual não conseguiu executar git status. Não presumir árvore limpa.

Para revisão cruzada, a segunda ferramenta começa somente leitura e procura bugs, regressões, violações de requisitos e testes faltantes. Relatar achados com evidências e impacto; não exigir mudanças apenas por preferência de estilo. A consulta ao assessor interno é opcional em tarefas simples.

## Prompt 1 — análise inicial sem implementação

> Leia AGENTS.md (Codex) ou CLAUDE.md (Claude Code), documentos/Passagem_de_trabalho.md e documentos/LEIA_PRIMEIRO.md; siga a ordem de leitura. Faça uma auditoria somente leitura do rascunho mobile e dos documentos, sem instalar, editar, executar builds ou acessar segredos. O principal Sol/Sonnet mantém a análise; use até duas pesquisas Luna/Haiku independentes quando úteis, somente leitura e com retorno curto. Use Astra/Opus para decisão importante quando pertinente. Confira modelos efetivos e relate limitações. Apresente divergências, aproveitamento da base e plano das etapas 0 e 1, priorizando Android, Tamagui, Biome e custo mínimo. Aguarde tarefa de implementação ao concluir.

## Prompt 2 — iniciar implementação das etapas 0 e 1

> Inicie as etapas 0 e 1 de documentos/Roteiro_de_implementacao.md. Leia AGENTS.md (Codex) ou CLAUDE.md (Claude Code), documentos/Passagem_de_trabalho.md e documentos/LEIA_PRIMEIRO.md; siga a ordem e leia mobile/AGENTS.md. Audite e corrija a base Expo e crie o design system pequeno com catálogo, usando TypeScript, Tamagui, Biome e Android primeiro. O principal Sol/Sonnet planeja e implementa; use Luna/Haiku para até duas pesquisas independentes somente leitura; consulte Astra/Opus para decisões importantes, erros recorrentes e revisão de lacunas quando pertinente. Confira modelos efetivos. Preserve mudanças locais, valide versões pelo SDK, produza lockfile consistente e corrija scripts/rotas do lote. Use dados demo; não conecte backend real, envie e-mails, ative APIs faturáveis ou publique. Decisões registradas prevalecem sobre trechos históricos divergentes; sincronize os documentos afetados sem inventar regras de produto. Execute verificações pertinentes, entregue evidências e limitações e atualize a passagem de trabalho.

## Prompt 3 — retomar um lote

> Leia a entrada da ferramenta, as regras compartilhadas e documentos/Passagem_de_trabalho.md. Inspecione o estado atual dos arquivos e retome somente o escopo de implementação já autorizado e registrado, preservando alterações existentes. Se não houver escopo autorizado, faça análise somente leitura. Use os modelos conforme os papéis do guia e registre modelos efetivos. Ao concluir, atualize a passagem com alterações, verificações, limitações e próximo passo.

## Prompt 4 — revisão cruzada

> Revise somente em leitura a entrega descrita em documentos/Passagem_de_trabalho.md. Compare alterações com requisitos e decisões confirmadas. Procure bugs, regressões, conflitos de regras e lacunas de validação; não edite nem instale. Use pesquisador e assessor apenas quando úteis, com modelos do guia. Entregue achados por impacto, caminhos/linhas, comportamento observado e evidência ainda necessária. Review não comprova execução Android ou integração real.

## Estado da base

Base auditada na tarefa autorizada de 8 de outubro de 2026: Expo 57, React Native 0.86.3 e React 19.2.3, instalação local, package-lock.json, scripts npm/Biome e catálogo Tamagui demo. Consulte Passagem_de_trabalho.md e Auditoria_da_base.md para evidências e pendências; não inferir execução Android da compilação. Não há backend conectado, migrations aplicadas, e-mail comprovado ou publicação. Não ler valores de .env.server.local para relatórios; o domínio informado divideai.com e a chave salva não comprovam DNS/SMTP funcionando.

## Modelo de retorno da pesquisa

> Pergunta: [uma questão concreta]. Fontes: [pastas/documentos/documentação oficial]. Restrições: somente leitura, sem segredos e sem comandos que escrevam. Retorno: síntese curta, caminhos/linhas ou links oficiais, evidências, divergências e incertezas.

## Registro de passagem

Atualizar Passagem_de_trabalho.md com data, ferramenta/modelos efetivos, escopo autorizado, etapa, arquivos alterados, verificações com resultados, limitações/bloqueios, decisões e próximo passo. Distinguir trabalho concluído de planejado.

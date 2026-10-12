# Divide aí — entrada do Codex

Leia e siga [regras compartilhadas](documentos/Regras_de_desenvolvimento.md), [passagem de trabalho](documentos/Passagem_de_trabalho.md) e [ordem de leitura](documentos/LEIA_PRIMEIRO.md).

Use GPT-6.1 Sol como principal. Delegue pesquisas independentes a GPT-6 Luna, somente leitura, até duas simultâneas quando úteis. Consulte GPT-6 Astra como assessor nos momentos relevantes descritos nas regras. As instruções autorizam essa delegação dentro da tarefa do usuário; confirme modelo e esforço efetivos. O principal escreve o código, integra e verifica.

No CLI, iniciar-codex.ps1 prepara os modelos e papéis por sessão. No app/IDE, use o prompt inicial do guia e selecione Sol no cliente. Não presumir que os arquivos de configuração do script CLI foram carregados pelo app.

Antes de alterar mobile/, ler mobile/AGENTS.md. Preferência explícita por Biome prevalece sobre lint genérico do template. Ao concluir um lote ou trocar de ferramenta, atualizar a passagem de trabalho.

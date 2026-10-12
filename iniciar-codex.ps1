param([string]$Prompt = "")

$ErrorActionPreference = "Stop"
$taskRoot = $PSScriptRoot
$taskLuna = (Join-Path $taskRoot "documentos/agentes/codex/pesquisador.toml").Replace("\", "/")
$taskAstra = (Join-Path $taskRoot "documentos/agentes/codex/assessor.toml").Replace("\", "/")
if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
    throw "Codex CLI não encontrado. Use o app com o prompt de documentos/Guia_para_agentes.md ou instale o CLI antes de iniciar."
}

# Configuração somente desta sessão; não altera configurações globais.
$taskArguments = @(
    "--model", "gpt-6.1-sol",
    "-c", 'model_reasoning_effort="medium"',
    "-c", "agents.enabled=true",
    "-c", "agents.max_concurrent_threads_per_session=2",
    "-c", 'agents.default_subagent_model="gpt-6-luna"',
    "-c", 'agents.default_subagent_reasoning_effort="high"',
    "-c", 'agents.pesquisador.description="Pesquisa delimitada somente leitura com Luna"',
    "-c", ('agents.pesquisador.config_file="' + $taskLuna + '"'),
    "-c", 'agents.assessor.description="Consulta de arquitetura, erro recorrente e revisão de lacunas com Astra"',
    "-c", ('agents.assessor.config_file="' + $taskAstra + '"')
)
if ($Prompt) { $taskArguments += $Prompt }
Push-Location -LiteralPath $taskRoot
try {
    & codex @taskArguments
    if ($LASTEXITCODE -ne 0) { throw "Codex encerrou com código $LASTEXITCODE. Confira versão, configuração e acesso aos modelos." }
} finally {
    Pop-Location
}

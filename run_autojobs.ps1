# O $PSScriptRoot pega o caminho dinâmico de onde este arquivo está salvo
$LogFile = "$PSScriptRoot\autojobs_log.txt"

Function Write-Log {
    Param ([string]$Message)

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"

    Write-Output $LogMessage
    Add-Content -Path $LogFile -Value $LogMessage
}

Write-Log "=== Iniciando execução do AutoJobs ==="


# ==========================================================
# 1. Configura e valida o Ollama
# ==========================================================

[Environment]::SetEnvironmentVariable(
    "OLLAMA_HOST",
    "0.0.0.0:11434",
    "Machine"
)

$env:OLLAMA_HOST = "0.0.0.0:11434"


$OllamaPort = Get-NetTCPConnection `
    -LocalPort 11434 `
    -State Listen `
    -ErrorAction SilentlyContinue


if (-not $OllamaPort) {

    Write-Log "Ollama não está escutando na porta 11434. Iniciando servidor..."


    $OllamaProcess = Get-Process `
        -Name "ollama" `
        -ErrorAction SilentlyContinue


    if ($OllamaProcess) {
        Write-Log "Processo Ollama encontrado, porém sem porta ativa. Encerrando..."
        
        Stop-Process `
            -Name "ollama" `
            -Force `
            -ErrorAction SilentlyContinue

        Start-Sleep -Seconds 3
    }


    Start-Process `
        -FilePath "ollama" `
        -ArgumentList "serve" `
        -WindowStyle Hidden


    Write-Log "Aguardando inicialização do Ollama..."

    Start-Sleep -Seconds 10


    $OllamaPort = Get-NetTCPConnection `
        -LocalPort 11434 `
        -State Listen `
        -ErrorAction SilentlyContinue


    if (-not $OllamaPort) {

        Write-Log "ERRO CRÍTICO: Ollama não abriu a porta 11434."
        exit 1

    } else {

        Write-Log "Servidor Ollama iniciado corretamente."
    }


} else {

    Write-Log "Ollama já está escutando na porta 11434."
}



# ==========================================================
# 2. Executa AutoJobs no WSL
# ==========================================================

$wslCommand = `
"cd /mnt/c/Repos/autojobs && pnpm exec tsx packages/engine/scripts/runEngine.ts"


Write-Log "Iniciando script no WSL..."


try {

    & wsl `
        --user marcio `
        bash -ilc $wslCommand `
        2>&1 |
        ForEach-Object {

            Write-Log "WSL: $_"

        }


    Write-Log "=== Execução concluída com sucesso ==="


}
catch {

    Write-Log "ERRO CRÍTICO no WSL: $_"

}


Write-Log "--------------------------------------------------"
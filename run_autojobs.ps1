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

# 1. Verifica o Ollama
$OllamaRodando = Get-Process -Name "ollama" -ErrorAction SilentlyContinue

if (-not $OllamaRodando) {
    Write-Log "Ollama não detectado. Iniciando servidor..."
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c set OLLAMA_HOST=0.0.0.0:11434 & ollama serve" -WindowStyle Hidden
    Start-Sleep -Seconds 5
    Write-Log "Servidor Ollama iniciado na porta 11434."
} else {
    Write-Log "Ollama já está em execução."
}

# 2. Executa no WSL
$wslCommand = "cd /mnt/c/Repos/autojobs && pnpm exec tsx packages/engine/scripts/runEngine.ts"
Write-Log "Iniciando script no WSL..."

try {
    $wslOutput = wsl --user marcio bash -ilc $wslCommand 2>&1
    foreach ($line in $wslOutput) {
        Write-Log "WSL: $line"
    }
    Write-Log "=== Execução concluída com sucesso ==="
} catch {
    Write-Log "ERRO CRÍTICO no WSL: $_"
}

Write-Log "--------------------------------------------------"
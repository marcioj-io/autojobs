# $PSScriptRoot pega o caminho dinâmico de onde este arquivo está salvo
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
# Função para verificar porta
# ==========================================================
Function Test-PortListening {
    Param (
        [int]$Port
    )
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return [bool]$conn
}

# ==========================================================
# Função para reiniciar Ollama
# ==========================================================
Function Restart-Ollama {
    Param (
        [int]$Port = 11434,
        [int]$TimeoutSeconds = 30
    )

    Write-Log "Tentando reiniciar Ollama na porta $Port..."

    # Encerra processos ollama se existirem
    $proc = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Log "Processo Ollama encontrado (PID(s): $($proc.Id -join ',')). Encerrando..."
        try {
            Stop-Process -Id $proc.Id -Force -ErrorAction Stop
            Write-Log "Processo Ollama encerrado."
        }
        catch {
            Write-Log "Falha ao encerrar processo Ollama: $_"
        }
    } else {
        Write-Log "Nenhum processo Ollama em execução encontrado."
    }

    Start-Sleep -Seconds 2

    # Inicia Ollama
    try {
        Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
        Write-Log "Comando de inicialização do Ollama enviado."
    }
    catch {
        Write-Log "Falha ao iniciar Ollama: $_"
        return $false
    }

    # Aguarda porta abrir com timeout
    $elapsed = 0
    $interval = 2
    while ($elapsed -lt $TimeoutSeconds) {
        Start-Sleep -Seconds $interval
        if (Test-PortListening -Port $Port) {
            Write-Log "Servidor Ollama está escutando na porta $Port."
            return $true
        }
        $elapsed += $interval
        Write-Log "Aguardando porta $Port... ($elapsed/$TimeoutSeconds s)"
    }

    Write-Log "ERRO: Timeout aguardando porta $Port abrir."
    return $false
}

# ==========================================================
# 1. Configura e valida o Ollama
# ==========================================================
[Environment]::SetEnvironmentVariable(
    "OLLAMA_HOST",
    "0.0.0.0:11434",
    "Machine"
)

$env:OLLAMA_HOST = "0.0.0.0:11434"

$Port = 11434
$OllamaListening = Test-PortListening -Port $Port

if ($OllamaListening) {

    Write-Log "Ollama já está escutando na porta $Port. Reiniciando por segurança..."

    $ok = Restart-Ollama -Port $Port -TimeoutSeconds 30

    if (-not $ok) {
        Write-Log "ERRO CRÍTICO: Não foi possível reiniciar o Ollama e abrir a porta $Port."
        exit 1
    }

} else {

    Write-Log "Ollama não está escutando na porta $Port. Iniciando servidor..."

    $ok = Restart-Ollama -Port $Port -TimeoutSeconds 30

    if (-not $ok) {
        Write-Log "ERRO CRÍTICO: Ollama não abriu a porta $Port após tentativa de inicialização."
        exit 1
    }
}

# ==========================================================
# 2. Executa AutoJobs no WSL
# ==========================================================
$wslCommand = "cd /mnt/c/Repos/autojobs && pnpm exec tsx packages/engine/scripts/runEngine.ts"

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

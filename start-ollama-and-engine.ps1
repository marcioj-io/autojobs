<#
  install-autojobs.ps1
  Uso: powershell -ExecutionPolicy Bypass -File "C:\services\install-autojobs.ps1" -RepoPath "C:\Repos\autojobs"
#>

param(
  [string]$RepoPath = "C:\Repos\autojobs",
  [string]$ServiceDir = "C:\services",
  [string]$LogsDir = "C:\services\logs",
  [string]$StartScriptName = "start-ollama-and-engine.ps1",
  [string]$LockFile = "C:\services\runEngine.lock",
  [string]$OllamaExe = "ollama"  # se necessário, coloque caminho absoluto
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Ensure-Admin {
  if (-not ([bool]([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator"))) {
    Write-Error "Este script precisa ser executado como Administrador."
    exit 1
  }
}

function Ensure-Dirs {
  param($dirs)
  foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
  }
}

function Write-Log {
  param($msg)
  $t = (Get-Date).ToString("o")
  $line = "[$t] $msg"
  Add-Content -Path (Join-Path $LogsDir "installer.log") -Value $line
  Write-Output $line
}

function Install-WSL-IfNeeded {
  # Retorna $true se reboot for necessário
  try {
    $wslInstalled = (wsl.exe --status) 2>$null
    if ($LASTEXITCODE -eq 0) {
      Write-Log "WSL já instalado."
      return $false
    }
  } catch {
    Write-Log "WSL não detectado. Instalando WSL..."
  }

  # Instala WSL (Windows 10/11). Pode pedir reboot.
  try {
    Write-Log "Executando: wsl --install -d Ubuntu"
    Start-Process -FilePath "wsl.exe" -ArgumentList "--install -d Ubuntu" -Wait -NoNewWindow
    Write-Log "WSL instalado. Reboot pode ser necessário."
    return $true
  } catch {
    Write-Log "Falha ao instalar WSL automaticamente: $_"
    throw
  }
}

function Install-Ollama-IfNeeded {
  # tenta winget; se não disponível, orienta download manual
  try {
    $found = Get-Command winget -ErrorAction SilentlyContinue
    if ($found) {
      Write-Log "Tentando instalar Ollama via winget..."
      # tenta instalar pacote conhecido; se falhar, loga e orienta
      $res = & winget install --id Ollama.Ollama -e --silent 2>&1
      Write-Log "winget output: $res"
      return
    } else {
      Write-Log "winget não encontrado. Verifique manualmente: https://ollama.ai/download"
    }
  } catch {
    Write-Log "Erro ao instalar Ollama via winget: $_"
  }
}

function Copy-StartScript {
  param($destDir)
  $scriptContent = @'
# start-ollama-and-engine.ps1
param()
$ErrorActionPreference = "Stop"
$repoWindowsPath = "{REPO_WINDOWS}"
$wslWorkdir = "{WSL_WORKDIR}"
$ollamaLog = "{LOGS}\ollama.log"
$engineLog = "{LOGS}\engine.log"
$ollamaExe = "{OLLAMA_EXE}"
$ollamaArgs = "serve"
$ollamaHostEnv = "0.0.0.0:11434"
$lockFile = "{LOCKFILE}"

# lock logic
if (Test-Path $lockFile) {
  $age = (Get-Date) - (Get-Item $lockFile).LastWriteTime
  if ($age.TotalHours -lt 6) {
    Add-Content -Path $engineLog -Value ("[LOCK] " + (Get-Date -Format o) + " Outra execução em andamento. Saindo.")
    exit 0
  } else {
    Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
  }
}
New-Item -Path $lockFile -ItemType File -Force | Out-Null

function Remove-Lock { if (Test-Path $lockFile) { Remove-Item $lockFile -Force -ErrorAction SilentlyContinue } }

try {
  New-Item -ItemType Directory -Path (Split-Path $ollamaLog) -Force | Out-Null

  # Start Ollama if needed
  $proc = Get-Process -Name 'ollama' -ErrorAction SilentlyContinue
  if (-not $proc) {
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $ollamaExe
    $startInfo.Arguments = $ollamaArgs
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.UseShellExecute = $false
    $startInfo.EnvironmentVariables['OLLAMA_HOST'] = $ollamaHostEnv

    $procObj = New-Object System.Diagnostics.Process
    $procObj.StartInfo = $startInfo
    $procObj.Start() | Out-Null

    Start-Job -ScriptBlock {
      param($o,$log)
      while (-not $o.EndOfStream) {
        $line = $o.ReadLine()
        Add-Content -Path $log -Value ("[OLLAMA] " + (Get-Date -Format o) + " " + $line)
      }
    } -ArgumentList $procObj.StandardOutput, $ollamaLog | Out-Null

    Start-Job -ScriptBlock {
      param($e,$log)
      while (-not $e.EndOfStream) {
        $line = $e.ReadLine()
        Add-Content -Path $log -Value ("[OLLAMA-ERR] " + (Get-Date -Format o) + " " + $line)
      }
    } -ArgumentList $procObj.StandardError, $ollamaLog | Out-Null

    Add-Content -Path $engineLog -Value ("[OLLAMA] " + (Get-Date -Format o) + " Ollama iniciado (PID: $($procObj.Id)).")
  } else {
    Add-Content -Path $engineLog -Value ("[OLLAMA] " + (Get-Date -Format o) + " Ollama já em execução.")
  }

  Start-Sleep -Seconds 6

  # Run engine inside WSL
  $wslCmd = "cd $wslWorkdir && pnpm install && pnpm exec tsx packages/engine/scripts/runEngine.ts >> /mnt/c/services/logs/engine.log 2>&1"
  Add-Content -Path $engineLog -Value ("[WSL] " + (Get-Date -Format o) + " Executando: $wslCmd")
  $proc = Start-Process -FilePath 'wsl.exe' -ArgumentList '-e','bash','-lc',$wslCmd -NoNewWindow -PassThru -Wait
  Add-Content -Path $engineLog -Value ("[WSL] " + (Get-Date -Format o) + " ExitCode: $($proc.ExitCode)")
} catch {
  Add-Content -Path $engineLog -Value ("[ERROR] " + (Get-Date -Format o) + " $_")
  throw
} finally {
  Remove-Lock
}
'@

  $wslWorkdir = ($RepoPath -replace 'C:\\','/mnt/c/').Replace('\','/')
  $scriptContent = $scriptContent -replace "{REPO_WINDOWS}", ($RepoPath -replace '\\','\\')
  $scriptContent = $scriptContent -replace "{WSL_WORKDIR}", $wslWorkdir
  $scriptContent = $scriptContent -replace "{LOGS}", ($LogsDir -replace '\\','\\')
  $scriptContent = $scriptContent -replace "{OLLAMA_EXE}", $OllamaExe
  $scriptContent = $scriptContent -replace "{LOCKFILE}", ($LockFile -replace '\\','\\')

  $destPath = Join-Path $destDir $StartScriptName
  $scriptContent | Out-File -FilePath $destPath -Encoding utf8 -Force
  Write-Log "Start script written to $destPath"
}

function Create-ScheduledTasks {
  $times = @("07:00","10:00","12:30","15:00","18:00")
  $names = @("AutopJobs_RunEngine_07","AutopJobs_RunEngine_10","AutopJobs_RunEngine_1230","AutopJobs_RunEngine_15","AutopJobs_RunEngine_18")
  for ($i=0; $i -lt $times.Length; $i++) {
    $tn = $names[$i]
    $st = $times[$i]
    $tr = "powershell.exe -ExecutionPolicy Bypass -File `"$ServiceDir\$StartScriptName`""
    Write-Log "Creating scheduled task $tn at $st"
    schtasks /Create /TN $tn /TR $tr /SC DAILY /ST $st /RL HIGHEST /RU "SYSTEM" /F | Out-Null
  }
}

# MAIN
Ensure-Admin
Ensure-Dirs -dirs @($ServiceDir, $LogsDir)
Write-Log "Installer started. RepoPath=$RepoPath"

# Install WSL if needed
$needReboot = $false
try {
  $needReboot = Install-WSL-IfNeeded
} catch {
  Write-Log "WSL installation failed: $_"
  throw
}

# Install Ollama
Install-Ollama-IfNeeded

# copy start script
Copy-StartScript -destDir $ServiceDir

# create lock file placeholder
if (-not (Test-Path $LockFile)) { New-Item -Path $LockFile -ItemType File -Force | Out-Null }

# create scheduled tasks
Create-ScheduledTasks

# initial run: install dependencies in WSL and run engine once
Write-Log "Running initial WSL setup: installing pnpm and running engine once."
try {
  $wslInit = @"
if ! command -v pnpm >/dev/null 2>&1; then
  echo 'Installing pnpm...'
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  export PATH=\$HOME/.local/share/pnpm:$PATH
fi
cd $wslWorkdir
pnpm install
pnpm exec tsx packages/engine/scripts/runEngine.ts
"@
  $tmp = Join-Path $env:TEMP "wsl_init.sh"
  $wslInit | Out-File -FilePath $tmp -Encoding utf8 -Force
  Start-Process -FilePath 'wsl.exe' -ArgumentList '-e','bash','-lc',"bash -lc 'cat > /tmp/wsl_init.sh << \"EOF\"`n$(Get-Content $tmp -Raw)`nEOF && bash /tmp/wsl_init.sh'" -Wait -NoNewWindow
  Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  Write-Log "Initial WSL run finished."
} catch {
  Write-Log "Initial WSL run failed: $_"
}

Write-Log "Installer finished."

if ($needReboot) {
  Write-Log "Reboot is recommended to complete WSL installation. Please reboot and re-run this script to finish setup."
  Write-Output "Reboot is recommended. Reboot now? (Y/N)"
  $r = Read-Host
  if ($r -match '^[Yy]') { Restart-Computer -Force }
}

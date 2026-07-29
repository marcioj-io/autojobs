$TaskName = "AutoJobs_WSL_Ollama"

# Aponta dinamicamente para o run_autojobs.ps1 na mesma pasta deste arquivo
$ScriptPath = "$PSScriptRoot\run_autojobs.ps1" 

$Action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`""

$Triggers = @(
    (New-ScheduledTaskTrigger -Daily -At "07:00"),
    (New-ScheduledTaskTrigger -Daily -At "10:00"),
    (New-ScheduledTaskTrigger -Daily -At "12:30"),
    (New-ScheduledTaskTrigger -Daily -At "15:00"),
    (New-ScheduledTaskTrigger -Daily -At "18:00")
)

$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

# O -Force garante que a tarefa do Windows será atualizada com o novo caminho
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Triggers -Settings $Settings -Description "Inicia Ollama e Roda script do AutoJobs no WSL via pnpm" -User $env:USERNAME -Force

Write-Host "Sucesso! A tarefa '$TaskName' foi atualizada para rodar a partir de: $ScriptPath" -ForegroundColor Green
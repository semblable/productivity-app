$ErrorActionPreference = "Stop"

$projectPath = (Resolve-Path "$PSScriptRoot\..").Path
$launcherBat = Join-Path $projectPath "scripts\startup-launcher.bat"
$launcherVbs = Join-Path $projectPath "scripts\startup-launcher.vbs"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$entryName = "MyLocalPlannerStartup"

if (!(Test-Path $launcherBat) -or !(Test-Path $launcherVbs)) {
  throw "Launcher scripts missing."
}

New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name $entryName -Value "wscript.exe `"$launcherVbs`"" -PropertyType String -Force | Out-Null

Write-Host "Enabled startup entry: $entryName"
Write-Host "It will silently launch My Local Planner at Windows logon."
Write-Host "To disable later run: npm run startup:remove"

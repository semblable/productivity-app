$ErrorActionPreference = "Stop"

$projectPath = (Resolve-Path "$PSScriptRoot\..").Path
$launcher = Join-Path $projectPath "scripts\startup-launcher.bat"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$entryName = "MyLocalPlannerStartup"

if (!(Test-Path $launcher)) {
  throw "Launcher script missing: $launcher"
}

New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name $entryName -Value "`"$launcher`"" -PropertyType String -Force | Out-Null

Write-Host "Enabled startup entry: $entryName"
Write-Host "It will launch $launcher at Windows logon."
Write-Host "To disable later run: npm run startup:remove"

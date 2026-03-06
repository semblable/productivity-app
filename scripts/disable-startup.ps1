$ErrorActionPreference = "Stop"

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$entryName = "MyLocalPlannerStartup"

Remove-ItemProperty -Path $runKey -Name $entryName -ErrorAction SilentlyContinue
Write-Host "Removed startup entry: $entryName (if it existed)."
Write-Host "To re-enable later run: npm run startup:install"

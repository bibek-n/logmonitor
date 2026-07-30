$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting IT Asset alerts run" | Out-File "D:\WWWROOT\LogMonitor\logs\it-asset-alerts.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-it-asset-alerts.ts" *>> "D:\WWWROOT\LogMonitor\logs\it-asset-alerts.log"
"$(Get-Date -Format o) IT Asset alerts run finished" | Out-File "D:\WWWROOT\LogMonitor\logs\it-asset-alerts.log" -Append

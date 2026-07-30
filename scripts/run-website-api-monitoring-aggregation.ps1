$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Website & API Monitoring aggregation" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-aggregation.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-website-api-monitoring-aggregation.ts" *>> "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-aggregation.log"
"$(Get-Date -Format o) Website & API Monitoring aggregation finished" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-aggregation.log" -Append

$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Website & API Monitoring scan" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-scan.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-website-api-monitoring-scan.ts" *>> "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-scan.log"
"$(Get-Date -Format o) Website & API Monitoring scan finished" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-scan.log" -Append

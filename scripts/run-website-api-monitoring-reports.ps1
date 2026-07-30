$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Website & API Monitoring scheduled reports" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-reports.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-website-api-monitoring-reports.ts" *>> "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-reports.log"
"$(Get-Date -Format o) Website & API Monitoring scheduled reports finished" | Out-File "D:\WWWROOT\LogMonitor\logs\website-api-monitoring-reports.log" -Append

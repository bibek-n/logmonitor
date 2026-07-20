$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting SQL Server monitoring scan" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\sqlserver-monitoring-scan.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-sqlserver-monitoring-scan.ts" *>> "D:\WWWROOT\LogMonitor\scripts\sqlserver-monitoring-scan.log"
"$(Get-Date -Format o) SQL Server monitoring scan finished" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\sqlserver-monitoring-scan.log" -Append

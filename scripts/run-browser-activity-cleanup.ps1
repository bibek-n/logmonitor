$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Browser Activity retention cleanup" | Out-File "D:\WWWROOT\LogMonitor\logs\browser-activity-cleanup.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\cleanup-browser-activity.ts" *>> "D:\WWWROOT\LogMonitor\logs\browser-activity-cleanup.log"
"$(Get-Date -Format o) Browser Activity retention cleanup finished" | Out-File "D:\WWWROOT\LogMonitor\logs\browser-activity-cleanup.log" -Append

$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Automation scheduled jobs" | Out-File "D:\WWWROOT\LogMonitor\logs\automation-schedules.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-automation-schedules.ts" *>> "D:\WWWROOT\LogMonitor\logs\automation-schedules.log"
"$(Get-Date -Format o) Automation scheduled jobs finished" | Out-File "D:\WWWROOT\LogMonitor\logs\automation-schedules.log" -Append

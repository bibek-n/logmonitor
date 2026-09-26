$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-update-schedules.ts" *>> "D:\WWWROOT\LogMonitor\logs\update-schedules.log"

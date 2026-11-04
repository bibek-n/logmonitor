$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting scheduled database backup" | Out-File "D:\WWWROOT\LogMonitor\logs\database-backup.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-scheduled-database-backup.ts" *>> "D:\WWWROOT\LogMonitor\logs\database-backup.log"
"$(Get-Date -Format o) scheduled database backup finished" | Out-File "D:\WWWROOT\LogMonitor\logs\database-backup.log" -Append

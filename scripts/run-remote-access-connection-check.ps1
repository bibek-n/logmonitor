$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Remote Access connection check" | Out-File "D:\WWWROOT\LogMonitor\logs\remote-access-connection-check.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-remote-access-connection-check.ts" *>> "D:\WWWROOT\LogMonitor\logs\remote-access-connection-check.log"
"$(Get-Date -Format o) Remote Access connection check finished" | Out-File "D:\WWWROOT\LogMonitor\logs\remote-access-connection-check.log" -Append

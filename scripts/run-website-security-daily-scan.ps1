$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting website security daily scan" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\website-security-daily-scan.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-website-security-daily-scan.ts" *>> "D:\WWWROOT\LogMonitor\scripts\website-security-daily-scan.log"
"$(Get-Date -Format o) website security daily scan finished" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\website-security-daily-scan.log" -Append

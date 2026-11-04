$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting monthly security digest" | Out-File -FilePath "D:\WWWROOT\LogMonitor\logs\monthly-security-digest.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-monthly-security-digest.ts" *>> "D:\WWWROOT\LogMonitor\logs\monthly-security-digest.log"
"$(Get-Date -Format o) monthly security digest finished" | Out-File -FilePath "D:\WWWROOT\LogMonitor\logs\monthly-security-digest.log" -Append

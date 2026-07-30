$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Security Center score snapshot" | Out-File "D:\WWWROOT\LogMonitor\logs\security-center-snapshot.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-security-center-snapshot.ts" *>> "D:\WWWROOT\LogMonitor\logs\security-center-snapshot.log"
"$(Get-Date -Format o) Security Center score snapshot finished" | Out-File "D:\WWWROOT\LogMonitor\logs\security-center-snapshot.log" -Append

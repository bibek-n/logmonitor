$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting Remote Access credential rotation check" | Out-File "D:\WWWROOT\LogMonitor\logs\remote-access-credential-rotation-check.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-remote-access-credential-rotation-check.ts" *>> "D:\WWWROOT\LogMonitor\logs\remote-access-credential-rotation-check.log"
"$(Get-Date -Format o) Remote Access credential rotation check finished" | Out-File "D:\WWWROOT\LogMonitor\logs\remote-access-credential-rotation-check.log" -Append

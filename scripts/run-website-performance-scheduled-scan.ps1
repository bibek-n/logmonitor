$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting website performance scheduled scan" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\website-performance-scheduled-scan.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-website-performance-scheduled-scan.ts" *>> "D:\WWWROOT\LogMonitor\scripts\website-performance-scheduled-scan.log"
"$(Get-Date -Format o) website performance scheduled scan finished" | Out-File -FilePath "D:\WWWROOT\LogMonitor\scripts\website-performance-scheduled-scan.log" -Append

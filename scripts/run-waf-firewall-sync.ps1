$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
"$(Get-Date -Format o) starting WAF firewall sync" | Out-File "D:\WWWROOT\LogMonitor\logs\waf-firewall-sync.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\run-waf-firewall-sync.ts" *>> "D:\WWWROOT\LogMonitor\logs\waf-firewall-sync.log"
"$(Get-Date -Format o) WAF firewall sync finished" | Out-File "D:\WWWROOT\LogMonitor\logs\waf-firewall-sync.log" -Append

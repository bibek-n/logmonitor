$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
$env:WAF_GATEWAY_PORT = "8099"
"$(Get-Date -Format o) starting WAF Gateway proxy" | Out-File "D:\WWWROOT\LogMonitor\logs\waf-gateway-server.log" -Append
& "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\scripts\waf-gateway-server.ts" *>> "D:\WWWROOT\LogMonitor\logs\waf-gateway-server.log"
"$(Get-Date -Format o) WAF Gateway proxy exited" | Out-File "D:\WWWROOT\LogMonitor\logs\waf-gateway-server.log" -Append

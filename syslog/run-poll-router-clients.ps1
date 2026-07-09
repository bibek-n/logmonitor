$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
while ($true) {
  "$(Get-Date -Format o) starting router client poller" | Out-File -FilePath "D:\WWWROOT\LogMonitor\syslog\poll-router-clients.log" -Append
  & "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\syslog\poll-router-clients.ts" *>> "D:\WWWROOT\LogMonitor\syslog\poll-router-clients.log"
  "$(Get-Date -Format o) poller exited, restarting in 5s" | Out-File -FilePath "D:\WWWROOT\LogMonitor\syslog\poll-router-clients.log" -Append
  Start-Sleep -Seconds 5
}

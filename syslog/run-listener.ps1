$ErrorActionPreference = "Continue"
Set-Location "D:\WWWROOT\LogMonitor"
while ($true) {
  "$(Get-Date -Format o) starting syslog listener" | Out-File -FilePath "D:\WWWROOT\LogMonitor\syslog\listener.log" -Append
  & "C:\Program Files\nodejs\node.exe" "D:\WWWROOT\LogMonitor\node_modules\tsx\dist\cli.mjs" "D:\WWWROOT\LogMonitor\syslog\listener.ts" *>> "D:\WWWROOT\LogMonitor\syslog\listener.log"
  "$(Get-Date -Format o) listener exited, restarting in 5s" | Out-File -FilePath "D:\WWWROOT\LogMonitor\syslog\listener.log" -Append
  Start-Sleep -Seconds 5
}

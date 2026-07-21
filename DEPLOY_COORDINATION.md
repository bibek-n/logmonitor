# Deploy coordination on the shared production server

`D:\WWWROOT\LogMonitor` on `192.168.1.15` is a single shared checkout that gets built and its
IIS app pool (`LogMonitorPool`) restarted directly on the box - there is no queue or CI gate in
front of it, so two people/sessions deploying at the same time can genuinely corrupt each
other's build (confirmed live on 2026-07-21: a `.next` directory left mid-write by a concurrent
`npm run build` caused `iisnode` to crash every request with "Could not find a production build"
until a session, unaware of the other one running, did a full clean rebuild).

## The convention

Before running `npm run build` or `Restart-WebAppPool -Name LogMonitorPool` against this server:

1. Check for `D:\WWWROOT\LogMonitor\DEPLOY.lock`. If it exists and its timestamp is recent
   (say, under 15 minutes old), someone else is deploying right now - wait, or check with the
   user before proceeding rather than racing it.
2. Before you start your own build, write the lock yourself:
   ```
   Set-Content -Path "D:\WWWROOT\LogMonitor\DEPLOY.lock" -Value "<who/what> - <UTC timestamp> - deploying <short description>"
   ```
3. Remove it when your build + restart is fully done (success or failure) so the next deploy
   isn't blocked indefinitely by a stale lock:
   ```
   Remove-Item "D:\WWWROOT\LogMonitor\DEPLOY.lock" -Force -ErrorAction SilentlyContinue
   ```

This is an honor-system file lock, not an enforced mutex - it only works if every
session/process deploying to this box actually checks it first. If you're a Claude Code session
reading this file as part of exploring the repo, please follow it.

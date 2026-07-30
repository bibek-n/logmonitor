# Intrusion Detection System (IDS)

Log collection, rule-based attack detection, alerting, file-integrity monitoring, and
reversible response actions, integrated into the existing Next.js + MSSQL app — not a
separate service. Everything lives under `src/app/api/admin/intrusion-detection/**` (API),
`src/app/dashboard/security/**` (pages), `src/components/intrusionDetection/**` (UI),
`src/lib/intrusionDetection/**` (shared logic), and `intrusion-detection/**` at the repo root
(background worker entry points, matching this app's existing top-level poller-script
convention alongside `syslog/`, `agent/`, `mobile/`).

## Install

```
npm run migrate:intrusion-detection
```

Idempotent — safe to re-run. Creates every table this module uses, **including its full
Phase 2 schema** (`SecurityResponseActions`, `SecurityNotificationChannels`,
`SecurityNotificationDeliveries`, `SecurityFileIntegrityBaselines`,
`SecurityFileIntegrityEvents`) — the migration was written once, up front, covering both
phases; only the application code to use the Phase 2 tables landed later. Seeds 21 starter
detection rules, 4 log sources (Sophos Threat, Sophos Web Filter, LogMonitor Login Activity,
LogMonitor IIS Access Log), one global path exclusion (`^/api/agent/`), and syncs one
`SecurityProtectedApplications` row per enabled website in the existing `Websites` table.

Scheduled tasks to register manually on the server (this app's established convention — no
in-repo automation registers Windows Scheduled Tasks):

| Script | Suggested interval | Purpose |
|---|---|---|
| `npx tsx intrusion-detection/collect.ts` | Every 1-5 minutes | Pulls new log lines from every enabled log source, runs the rule engine, creates/updates alerts. |
| `npx tsx intrusion-detection/check-file-integrity.ts` | Every 15-60 minutes | Re-hashes every monitored file, records/alerts on drift. |
| `npx tsx scripts/run-waf-firewall-sync.ts` | Every 1-5 minutes | Diffs `SecurityIpBlocklist` against real Windows Firewall rules on this host (shared with the SecurityCenter WAF module — one enforcement job, two features feed it). |

Neither worker script has a `.ps1` wrapper — both are one-shot `dotenv/config` scripts run
directly by the Scheduled Task's own Action (`node.exe` + the `tsx` CLI path + script path),
matching `syslog/poll-*.ts`'s existing convention.

## Permissions

**Deliberately separate from this app's `PERMISSION_KEYS`/`RolePermissions` system** — see the
comment in `src/lib/permissionKeys.ts`. IDS uses its own lightweight `SecurityUserRoles` table
and `requireSecurityRole()` (`src/lib/intrusionDetection/requireSecurityRole.ts`), layered on
top of (never replacing) `requireAdmin()`:

| Role | Rank | Typical access |
|---|---|---|
| `viewer` | 0 | Every GET endpoint — dashboard, alerts, events, rules, file integrity, notification channel list, response action list. |
| `security_analyst` | 1 | + alert notes/status changes, acknowledging file-integrity events. |
| `security_admin` | 2 | + rule tuning, allowlist/blocklist management, website management, file-integrity baseline add/remove, notification channel CRUD + test, response action request/execute/rollback. |

A user with no `SecurityUserRoles` row defaults to `security_admin` (this app currently seeds
only a single "Admin" role app-wide, so this default keeps IDS usable before a real
multi-role rollout). Admin always bypasses every check, same superuser convention used
everywhere else in this app.

## Database

Every table is prefixed `Security` (all `Id INT/BIGINT IDENTITY(1,1) PRIMARY KEY`, named FK
constraints, no `ON DELETE CASCADE` except where explicitly noted — matches this app's
existing convention).

**Phase 1** (collection/detection/investigation): `SecurityProtectedApplications`,
`SecurityLogSources`, `SecurityEvents`, `SecurityDetectionRules`, `SecurityRuleExclusions`,
`SecurityIpProfiles`, `SecurityIpAllowlist`, `SecurityIpBlocklist`, `SecurityAlerts`,
`SecurityAlertNotes`, `SecurityAlertStatusHistory`, `SecurityCollectorHealth`,
`SecurityRetentionSettings`, `SecurityUserRoles`.

**Phase 2** (this pass):

| Table | Purpose |
|---|---|
| `SecurityResponseActions` | One row per requested response action. `Status`: `Pending` → `Executed` / `Failed`, or `Simulated` (dry-run request, not yet executed) → `Executed`, or `Executed` → `RolledBack`. `DryRun` defaults to `1` — requesting an action never does anything by itself; a separate `[id]/execute` call is always required. |
| `SecurityNotificationChannels` | One row per configured Slack/Teams/webhook/email/in-app destination. `EncryptedConfig` is AES-256-GCM ciphertext (see "Notification channels" below) — never plaintext, never returned by the list/get API. `MinSeverity` is the channel's own independent threshold. |
| `SecurityNotificationDeliveries` | Append-only send log — one row per (alert, channel) delivery attempt, `Status`: `Sent` / `Failed`. |
| `SecurityFileIntegrityBaselines` | One row per monitored file. `FilePath` unique. `Sha256Hash`/`SizeBytes`/`Permissions` are the last-known-good snapshot, re-baselined automatically after each detected change (see "File integrity monitoring" below). |
| `SecurityFileIntegrityEvents` | Append-only detail log of every detected change (`ChangeType`: `Modified` / `Deleted`; `Created` is a valid value but unreachable in this module's single-file-baseline model). |

## File integrity monitoring

Watches specific files **on this application's own host** (config files, secrets, startup
scripts — self-protection) — a different, parallel feature from the endpoint-agent
`WatchedFiles`/`FileIntegrityEvents` tables (`agent/fileintegrity.go`), which monitors files on
remote managed devices. The two don't share tables or code; they share only the SHA-256
hex-hashing convention.

- `src/lib/intrusionDetection/fileIntegrity.ts` — `snapshotFile()` (SHA-256 + size + a
  best-effort octal permissions string; Windows has no real POSIX permission bits, so this is
  honestly disclosed as best-effort rather than treated as a real ACL), `addBaseline()`,
  `checkFileIntegrity()` (re-hashes every baseline, records an event + creates a
  `SecurityAlerts` row on drift, re-baselines to the new hash immediately after alerting so the
  same change never re-alerts on the next run), `listEvents()`, `acknowledgeEvent()`.
- A detected change is reported as a normal `SecurityAlerts` row (`Category: "file_integrity"`,
  already a valid value in `AttackCategory`) — it appears in the same Alerts feed,
  investigation UI, and notification pipeline as every rule-engine-detected attack. A deleted
  file is `critical` severity; a modified file is `high`.
- Admin UI: "File Integrity" tab in the Security Dashboard — add a file by absolute path, see
  its current baseline hash, remove it, trigger an on-demand check, review/acknowledge the
  change history.
- API: `GET/POST /file-integrity/baselines`, `DELETE /file-integrity/baselines/[id]`,
  `GET /file-integrity/events`, `PATCH /file-integrity/events/[id]/acknowledge`,
  `POST /file-integrity/check` (manual trigger — same logic the scheduled task runs).

## Notification integrations

`src/lib/intrusionDetection/notificationChannels.ts` fans a new alert out to every enabled
channel whose `MinSeverity` is at or below the alert's own severity — additive to (not a
replacement for) the existing default-recipients email path (`getModuleRecipients
("intrusion-detection")` in `alertManager.ts`, unchanged).

- **Reuses, rather than reimplements**, the Slack/Teams/webhook/in-app senders already built
  for Website & API Monitoring (`src/lib/websiteApiMonitoring/alertChannels.ts`) — those
  functions are generic (`webhookUrl`/`subject`/`body` in, `success`/`error` out) and carry no
  website-monitoring-specific assumptions. Email continues to use this app's one hand-rolled
  raw-SMTP sender (`src/lib/notifyEmail.ts`) — nodemailer is avoided everywhere in this app due
  to a known crash on this Windows/iisnode host.
- Channel configs (webhook URLs, signing secrets) are AES-256-GCM encrypted at rest via
  `src/lib/intrusionDetection/secretCrypto.ts` — same `scryptSync(NEXTAUTH_SECRET, <module
  salt>, 32)` key-derivation pattern this app's majority of secret-encryption modules already
  use (`src/lib/mailSecurity/credentials.ts` and others), with its own unique salt string so
  the derived key differs from every other module. The list/get API never returns the
  decrypted config, only `hasConfig: boolean` — decryption happens only at send time.
- Channel types: `slack`, `teams`, `webhook` (optional HMAC-SHA256 `X-Signature` header),
  `email` (extra/override recipients beyond the module default), `in_app` (inserts into the
  shared `InAppNotifications` table by username).
- API: `GET/POST /notification-channels`, `PATCH/DELETE /notification-channels/[id]`,
  `POST /notification-channels/[id]/test` (sends a synthetic test message right now,
  regardless of the channel's enabled/severity settings — verifies configuration before
  relying on it).

## Response actions

`src/lib/intrusionDetection/responseActions.ts`. Two action types, both genuinely enforceable
end to end — deliberately not three:

- **`block_ip`** — writes to `SecurityIpBlocklist`, which `scripts/run-waf-firewall-sync.ts`
  (already built, runs on its own schedule) diffs against real Windows Firewall rules on this
  host. Executing this action hands off to that existing, idempotent enforcement job rather
  than touching the firewall directly.
- **`disable_account`** — flips `Users.IsActive = 0`, the same column the Settings > Users
  admin UI already toggles. Blocks all *future* logins immediately.
- **No `kill_session` action is offered.** This app uses NextAuth's stateless JWT session
  strategy with no server-side session store, and neither the JWT callback nor
  `requireAdmin()` re-check `Users.IsActive` per request — so there is no real mechanism to
  invalidate an already-issued session token short of rotating `NEXTAUTH_SECRET` app-wide
  (which logs out every user, not just one). A "kill session" button that silently did nothing
  to an attacker's live session would be worse than not offering it; `disable_account`'s
  Result field states this limitation explicitly rather than overselling what it did.

Workflow: `POST /response-actions` (dry-run by default — `Simulated`/`Pending`, never touches
anything) → `POST /response-actions/[id]/execute` (does the real thing, records a
human-readable `Result`) → optionally `POST /response-actions/[id]/rollback` (`block_ip`:
deactivates the blocklist entry, next WAF sync run removes the firewall rule;
`disable_account`: re-enables the account). Target values are validated before anything
touches the database — `block_ip` requires a plain IP/CIDR (same strict regex
`run-waf-firewall-sync.ts` uses before shelling out to PowerShell), `disable_account` requires
a plausible username shape.

The pre-existing `POST /blocklist` route (Phase 1) still exists as a lower-friction
"just track it, don't enforce it yet" path for entries that don't need the full
request/execute/rollback review workflow.

## Frontend

Three new tabs in `SecurityDashboardClient.tsx` (`src/components/intrusionDetection/`),
alongside the existing Alerts/Events/Rules/Websites/Website Report/Allowlist/Blocklist tabs:

- **File Integrity** — monitored-file list with SHA-256/size/last-verified, add/remove, manual
  check-now, change history with acknowledge.
- **Notifications** — channel list with type/min-severity/enabled toggle/test/remove, add form
  with per-type config fields.
- **Response Actions** — request form (action type, target, dry-run checkbox), action history
  table with Execute/Rollback buttons gated by current status.

## Tests

Co-located `*.test.ts` files next to their implementation (this app's established
convention), added for every pure/deterministic piece of the Phase 2 modules:

- `secretCrypto.test.ts` — encrypt/decrypt round-trip, random-IV uniqueness, stored-format
  shape, tamper detection (corrupted auth tag throws).
- `fileIntegrity.test.ts` — `snapshotFile()` against real temporary files (hash/size
  correctness, change detection, missing-file handling), `addBaseline()`'s
  reject-before-touching-the-database paths.
- `notificationChannels.test.ts` — `listChannels()` never exposes decrypted config,
  `dispatchAlertNotifications()`'s severity/enabled filtering (DB-mocked, following this
  repo's `vi.mock("@/lib/db", ...)` convention already used in `remoteAccess/*.test.ts`).
- `responseActions.test.ts` — `validateTarget()`'s IP/CIDR and username validation (including
  rejecting shell-meaningful characters), `requestAction()`'s dry-run-vs-pending status
  selection, `executeAction()`/`rollbackAction()`'s status-guard rules (DB-mocked).

Phase 1 (rule engine, risk scoring, redaction, alert manager, adapters) has no test coverage
yet — out of scope for this pass, which focused on the newly-built Phase 2 surface.

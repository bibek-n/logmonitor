import { getDb, sql } from "@/lib/db";

// Each function is a best-effort signal derived from data this app already collects for an
// unrelated feature (malware scanning, SQL/website backups, TOTP/passkey enrollment, etc.) -
// never a certified compliance attestation. "unknown" means the underlying feature has no data
// at all (not configured/never run), which is deliberately distinct from "fail" (configured and
// showing a problem) - a control an admin never touched shouldn't silently read as failing.
export interface AutoCheckResult {
  status: "pass" | "fail" | "unknown";
  detail: string;
}

async function checkMalwareScanning(): Promise<AutoCheckResult> {
  const db = await getDb();
  const openSerious = await db.query<{ Cnt: number }>`
    SELECT COUNT(*) AS Cnt FROM MalwareFindings WHERE Status = 'Open' AND Severity IN ('Critical', 'High')
  `;
  if (openSerious.recordset[0].Cnt > 0) {
    return { status: "fail", detail: `${openSerious.recordset[0].Cnt} open Critical/High malware finding(s).` };
  }
  const recentScans = await db.query<{ Cnt: number }>`
    SELECT COUNT(*) AS Cnt FROM MalwareScans WHERE Status = 'Completed' AND CompletedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())
  `;
  if (recentScans.recordset[0].Cnt === 0) {
    const anyScans = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM MalwareScans`;
    if (anyScans.recordset[0].Cnt === 0) return { status: "unknown", detail: "No malware scans have ever been run." };
    return { status: "fail", detail: "No malware scan completed in the last 30 days." };
  }
  return { status: "pass", detail: `${recentScans.recordset[0].Cnt} malware scan(s) completed in the last 30 days, no open Critical/High findings.` };
}

async function checkSslCertificates(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ Total: number; Expired: number }>`
    SELECT COUNT(*) AS Total, SUM(CASE WHEN SslExpiresAt < SYSUTCDATETIME() THEN 1 ELSE 0 END) AS Expired
    FROM IisSites WHERE SslExpiresAt IS NOT NULL
  `;
  const { Total, Expired } = result.recordset[0];
  if (Total === 0) return { status: "unknown", detail: "No IIS sites with SSL certificate data collected yet." };
  if (Expired > 0) return { status: "fail", detail: `${Expired} of ${Total} monitored site(s) have an expired SSL certificate.` };
  return { status: "pass", detail: `All ${Total} monitored site(s) have a valid, non-expired SSL certificate.` };
}

async function checkIntrusionMonitoring(): Promise<AutoCheckResult> {
  const db = await getDb();
  const total = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM SecurityEvents`;
  if (total.recordset[0].Cnt === 0) return { status: "unknown", detail: "Intrusion Detection has not logged any events yet." };
  const recent = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM SecurityEvents WHERE EventTime >= DATEADD(DAY, -14, SYSUTCDATETIME())`;
  if (recent.recordset[0].Cnt === 0) return { status: "fail", detail: "No intrusion detection events logged in the last 14 days - monitoring may have stopped." };
  return { status: "pass", detail: `Intrusion detection actively logging - ${recent.recordset[0].Cnt} event(s) in the last 14 days.` };
}

async function checkAuditLogging(): Promise<AutoCheckResult> {
  const db = await getDb();
  const total = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM AdminAuditLog`;
  if (total.recordset[0].Cnt === 0) return { status: "unknown", detail: "No admin actions have been logged yet." };
  return { status: "pass", detail: `Admin audit logging is active - ${total.recordset[0].Cnt} action(s) recorded to date.` };
}

async function checkBackupStatus(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ CreatedAt: string; Status: string }>`
    SELECT TOP 1 CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, Status FROM BackupHistory ORDER BY CreatedAt DESC
  `;
  const latest = result.recordset[0];
  if (!latest) return { status: "unknown", detail: "No application backup has ever been taken." };
  if (latest.Status !== "Success" && latest.Status !== "Completed") {
    return { status: "fail", detail: `Most recent backup (${latest.CreatedAt}) did not complete successfully (status: ${latest.Status}).` };
  }
  const ageMs = Date.now() - new Date(latest.CreatedAt + "Z").getTime();
  if (ageMs > 7 * 86400000) {
    return { status: "fail", detail: `Most recent successful backup was ${latest.CreatedAt} - over 7 days ago.` };
  }
  return { status: "pass", detail: `Most recent backup succeeded on ${latest.CreatedAt}.` };
}

// "Has MFA" = TOTP enabled OR at least one registered passkey - checked for every active Admin
// account, not just one, since a compliance control about authentication means ALL privileged
// accounts, not "at least one admin happens to have it on."
async function checkMfaEnabled(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ Total: number; WithMfa: number }>`
    SELECT COUNT(*) AS Total,
      SUM(CASE WHEN u.TotpEnabled = 1 OR EXISTS (SELECT 1 FROM UserPasskeys p WHERE p.UserId = u.Id) THEN 1 ELSE 0 END) AS WithMfa
    FROM Users u WHERE u.Role = 'Admin' AND (u.IsActive = 1 OR u.IsActive IS NULL)
  `;
  const { Total, WithMfa } = result.recordset[0];
  if (Total === 0) return { status: "unknown", detail: "No active admin accounts found." };
  if (WithMfa < Total) return { status: "fail", detail: `${WithMfa} of ${Total} active admin account(s) have MFA (TOTP or a passkey) enrolled.` };
  return { status: "pass", detail: `All ${Total} active admin account(s) have MFA (TOTP or a passkey) enrolled.` };
}

async function checkVulnerabilityScanning(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ Cnt: number }>`
    SELECT
      (SELECT COUNT(*) FROM ThreatScans WHERE Status = 'Completed' AND CompletedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) +
      (SELECT COUNT(*) FROM WebsiteAuditScans WHERE ScanDate >= DATEADD(DAY, -30, SYSUTCDATETIME())) +
      (SELECT COUNT(*) FROM SecurityHeaderScans WHERE ScannedAt >= DATEADD(DAY, -30, SYSUTCDATETIME())) AS Cnt
  `;
  if (result.recordset[0].Cnt > 0) {
    return { status: "pass", detail: `${result.recordset[0].Cnt} vulnerability/security scan(s) (threat scanner, website audit, or security headers) run in the last 30 days.` };
  }
  const everRun = await db.query<{ Cnt: number }>`
    SELECT (SELECT COUNT(*) FROM ThreatScans) + (SELECT COUNT(*) FROM WebsiteAuditScans) + (SELECT COUNT(*) FROM SecurityHeaderScans) AS Cnt
  `;
  if (everRun.recordset[0].Cnt === 0) return { status: "unknown", detail: "No vulnerability/security scans have ever been run." };
  return { status: "fail", detail: "No vulnerability/security scan run in the last 30 days." };
}

async function checkPatchManagement(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ Total: number; Recent: number }>`
    SELECT COUNT(*) AS Total, SUM(CASE WHEN LastWindowsUpdateAt >= DATEADD(DAY, -60, SYSUTCDATETIME()) THEN 1 ELSE 0 END) AS Recent
    FROM Devices WHERE DeviceType = 'Server' AND OS = 'windows'
  `;
  const { Total, Recent } = result.recordset[0];
  if (Total === 0) return { status: "unknown", detail: "No Windows servers with update-status data collected yet." };
  const pct = Recent / Total;
  if (pct < 0.8) return { status: "fail", detail: `Only ${Recent} of ${Total} Windows server(s) installed an update in the last 60 days.` };
  return { status: "pass", detail: `${Recent} of ${Total} Windows server(s) installed an update in the last 60 days.` };
}

async function checkDeviceInventory(): Promise<AutoCheckResult> {
  const db = await getDb();
  const result = await db.query<{ Cnt: number }>`SELECT COUNT(*) AS Cnt FROM Devices`;
  if (result.recordset[0].Cnt === 0) return { status: "unknown", detail: "No devices enrolled yet." };
  return { status: "pass", detail: `${result.recordset[0].Cnt} device(s) tracked in the asset inventory.` };
}

export const AUTO_CHECKS: Record<string, () => Promise<AutoCheckResult>> = {
  malware_scanning: checkMalwareScanning,
  ssl_certificates: checkSslCertificates,
  intrusion_monitoring: checkIntrusionMonitoring,
  audit_logging: checkAuditLogging,
  backup_status: checkBackupStatus,
  mfa_enabled: checkMfaEnabled,
  vulnerability_scanning: checkVulnerabilityScanning,
  patch_management: checkPatchManagement,
  device_inventory: checkDeviceInventory,
};

// Runs every distinct AutoCheckKey once (not once per control - several controls across
// frameworks share the same key, e.g. "mfa_enabled" appears in ISO 27001, PCI DSS, HIPAA, NIST,
// and SOC 2) and writes the result onto every control referencing that key.
export async function runAllAutoChecks(): Promise<{ key: string; result: AutoCheckResult }[]> {
  const db = await getDb();
  const results: { key: string; result: AutoCheckResult }[] = [];

  for (const [key, check] of Object.entries(AUTO_CHECKS)) {
    let result: AutoCheckResult;
    try {
      result = await check();
    } catch (err) {
      result = { status: "unknown", detail: `Auto-check failed: ${err instanceof Error ? err.message : "unknown error"}` };
    }
    results.push({ key, result });

    await db
      .request()
      .input("key", sql.VarChar, key)
      .input("status", sql.VarChar, result.status)
      .input("detail", sql.NVarChar, result.detail)
      .query(`
        UPDATE ComplianceControls
        SET AutoCheckStatus = @status, AutoCheckDetail = @detail, AutoCheckedAt = SYSUTCDATETIME()
        WHERE AutoCheckKey = @key
      `);
  }

  return results;
}

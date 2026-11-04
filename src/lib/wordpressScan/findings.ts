import crypto from "crypto";
import { getDb, sql } from "@/lib/db";
import type { AdminSession } from "@/lib/requireAdmin";
import type { ScanFinding } from "./shared";

export const FINDING_STATUSES = ["Open", "InProgress", "Resolved", "AcceptedRisk", "FalsePositive"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export function isFindingStatus(value: unknown): value is FindingStatus {
  return typeof value === "string" && (FINDING_STATUSES as readonly string[]).includes(value);
}

// Stable per-website identity for a finding across scans, so the same issue is tracked/
// triaged over time instead of appearing as a brand-new row on every scan. Deliberately
// excludes volatile per-scan details (evidence, exact version strings in the title's
// surrounding context is accepted as a minor limitation — a plugin-version bump changing the
// title text will start a "new" finding rather than updating the old one, which is the
// simplest, safest behavior to ship first; see check+title as the identity, not full detail).
function computeFindingKey(websiteId: number, check: string, title: string): string {
  return crypto.createHash("sha256").update(`${websiteId}|${check}|${title}`).digest("hex").slice(0, 64);
}

// Called from persist.ts right after a scan is saved, for any scan tied to a saved website.
// Upserts every finding from this scan by its stable key (new findings start life as Open;
// an existing finding only has its LastSeen* touched, its Status is left alone so triage work
// isn't clobbered by the next scan), then auto-resolves any still-open finding that this scan
// did NOT see again — the standard "disappeared = fixed" convention most scanners use.
export async function upsertFindingsForScan(websiteId: number, scanId: number, findings: ScanFinding[]): Promise<void> {
  const db = await getDb();
  const seenKeys = new Set<string>();

  for (const f of findings) {
    const key = computeFindingKey(websiteId, f.check, f.title);
    seenKeys.add(key);

    const existing = await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("key", sql.VarChar, key)
      .query<{ Id: number }>("SELECT Id FROM WordPressFindings WHERE WebsiteId = @websiteId AND FindingKey = @key");

    if (existing.recordset[0]) {
      await db
        .request()
        .input("id", sql.Int, existing.recordset[0].Id)
        .input("scanId", sql.Int, scanId)
        .input("severity", sql.VarChar, f.severity)
        .input("detail", sql.NVarChar, f.detail ?? null)
        .input("evidence", sql.NVarChar, f.evidence ?? null)
        .query(
          `UPDATE WordPressFindings SET LastSeenScanId = @scanId, LastSeenAt = SYSUTCDATETIME(), Severity = @severity, Detail = @detail, Evidence = @evidence WHERE Id = @id`
        );
    } else {
      await db
        .request()
        .input("websiteId", sql.Int, websiteId)
        .input("key", sql.VarChar, key)
        .input("check", sql.VarChar, f.check)
        .input("severity", sql.VarChar, f.severity)
        .input("title", sql.NVarChar, f.title)
        .input("detail", sql.NVarChar, f.detail ?? null)
        .input("evidence", sql.NVarChar, f.evidence ?? null)
        .input("scanId", sql.Int, scanId)
        .query(
          `INSERT INTO WordPressFindings (WebsiteId, FindingKey, CheckId, Severity, Title, Detail, Evidence, Status, FirstSeenScanId, LastSeenScanId)
           VALUES (@websiteId, @key, @check, @severity, @title, @detail, @evidence, 'Open', @scanId, @scanId)`
        );
    }
  }

  // Auto-resolve: any currently-open/in-progress finding for this website that this scan
  // didn't re-report. Accepted-risk and false-positive findings are deliberately left alone —
  // those are explicit human decisions, not something a scan's absence should overturn.
  const openRows = await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .query<{ Id: number; Status: string; FindingKey: string }>(
      `SELECT Id, Status, FindingKey FROM WordPressFindings WHERE WebsiteId = @websiteId AND Status IN ('Open','InProgress')`
    );

  for (const row of openRows.recordset) {
    if (seenKeys.has(row.FindingKey)) continue; // re-reported this scan, still open

    await db.request().input("id", sql.Int, row.Id).input("oldStatus", sql.VarChar, row.Status).query(`
      UPDATE WordPressFindings SET Status = 'Resolved', ResolvedAt = SYSUTCDATETIME() WHERE Id = @id
    `);
    await db
      .request()
      .input("findingId", sql.Int, row.Id)
      .input("old", sql.VarChar, row.Status)
      .query(
        `INSERT INTO WordPressFindingStatusHistory (FindingId, OldStatus, NewStatus, ChangedByUsername, Reason)
         VALUES (@findingId, @old, 'Resolved', 'system:auto-resolve', 'Not detected in latest scan')`
      );
  }
}

export interface FindingListFilters {
  websiteId?: number;
  status?: FindingStatus;
  severity?: string;
  page: number;
  pageSize: number;
}

export interface FindingListRow {
  Id: number;
  WebsiteId: number;
  WebsiteName: string;
  CheckId: string;
  Severity: string;
  Title: string;
  Detail: string | null;
  Evidence: string | null;
  Status: string;
  AuditorNote: string | null;
  FirstSeenAt: string;
  LastSeenAt: string;
  ResolvedAt: string | null;
}

export async function listFindings(filters: FindingListFilters): Promise<{ rows: FindingListRow[]; total: number }> {
  const db = await getDb();
  const offset = (filters.page - 1) * filters.pageSize;

  // Same "@param IS NULL OR f.Col = @param" pattern for both queries below, so an omitted
  // filter is a true no-op rather than needing a second, differently-built WHERE clause.
  const countResult = await db
    .request()
    .input("websiteId", sql.Int, filters.websiteId ?? null)
    .input("status", sql.VarChar, filters.status ?? null)
    .input("severity", sql.VarChar, filters.severity ?? null).query<{ total: number }>(`
      SELECT COUNT(*) AS total FROM WordPressFindings f
      WHERE (@websiteId IS NULL OR f.WebsiteId = @websiteId)
        AND (@status IS NULL OR f.Status = @status)
        AND (@severity IS NULL OR f.Severity = @severity)
    `);
  const total = countResult.recordset[0].total;

  const rowsResult = await db
    .request()
    .input("websiteId", sql.Int, filters.websiteId ?? null)
    .input("status", sql.VarChar, filters.status ?? null)
    .input("severity", sql.VarChar, filters.severity ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, filters.pageSize).query<FindingListRow>(`
      SELECT f.Id, f.WebsiteId, w.Name AS WebsiteName, f.CheckId, f.Severity, f.Title, f.Detail, f.Evidence, f.Status, f.AuditorNote,
        CONVERT(VARCHAR(19), f.FirstSeenAt, 126) AS FirstSeenAt,
        CONVERT(VARCHAR(19), f.LastSeenAt, 126) AS LastSeenAt,
        CONVERT(VARCHAR(19), f.ResolvedAt, 126) AS ResolvedAt
      FROM WordPressFindings f
      JOIN Websites w ON w.Id = f.WebsiteId
      WHERE (@websiteId IS NULL OR f.WebsiteId = @websiteId)
        AND (@status IS NULL OR f.Status = @status)
        AND (@severity IS NULL OR f.Severity = @severity)
      ORDER BY
        CASE f.Severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        f.LastSeenAt DESC
      OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `);

  return { rows: rowsResult.recordset, total };
}

export async function updateFindingStatus(id: number, status: FindingStatus, reason: string | null, actor: AdminSession): Promise<boolean> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Status: string }>("SELECT Status FROM WordPressFindings WHERE Id = @id");
  const row = existing.recordset[0];
  if (!row) return false;
  if (row.Status === status) return true; // no-op, nothing to record

  const resolvedAtClause = status === "Resolved" ? "ResolvedAt = SYSUTCDATETIME()" : "ResolvedAt = NULL";
  await db.request().input("id", sql.Int, id).input("status", sql.VarChar, status).query(`
    UPDATE WordPressFindings SET Status = @status, ${resolvedAtClause} WHERE Id = @id
  `);
  await db
    .request()
    .input("findingId", sql.Int, id)
    .input("old", sql.VarChar, row.Status)
    .input("new", sql.VarChar, status)
    .input("uid", sql.Int, actor.userId)
    .input("by", sql.NVarChar, actor.username)
    .input("reason", sql.NVarChar, reason)
    .query(
      `INSERT INTO WordPressFindingStatusHistory (FindingId, OldStatus, NewStatus, ChangedByUserId, ChangedByUsername, Reason)
       VALUES (@findingId, @old, @new, @uid, @by, @reason)`
    );
  return true;
}

// Free-text note an auditor can set independent of Status — covers the common case of
// "I can't fix this myself, here's why" without needing the admin-only status-change
// permission. Not written to WordPressFindingStatusHistory; that trail stays status-only.
export async function updateFindingNote(id: number, note: string | null): Promise<boolean> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).input("note", sql.NVarChar, note).query(
    "UPDATE WordPressFindings SET AuditorNote = @note WHERE Id = @id"
  );
  return (result.rowsAffected[0] ?? 0) > 0;
}

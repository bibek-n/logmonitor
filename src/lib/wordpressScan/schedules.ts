import { getDb, sql } from "@/lib/db";
import type { AdminSession } from "@/lib/requireAdmin";
import { runWordPressDeepScan } from "./runScan";
import { saveWordPressScan } from "./persist";
import { isScanProfile, type ScanProfile } from "./shared";

export const RECURRENCES = ["daily", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export function isRecurrence(value: unknown): value is Recurrence {
  return typeof value === "string" && (RECURRENCES as readonly string[]).includes(value);
}

function advance(from: Date, recurrence: Recurrence): Date {
  const next = new Date(from.getTime());
  if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

export interface ScheduleRow {
  WebsiteId: number;
  WebsiteName: string;
  WebsiteUrl: string;
  ScheduleId: number | null;
  Recurrence: Recurrence | null;
  Profile: ScanProfile | null;
  NextRunAt: string | null;
  LastRunAt: string | null;
  IsActive: boolean | null;
}

// Every enabled WordPress site, LEFT JOINed to its schedule (if any) so a site with no
// schedule yet still shows up — the UI lets the admin configure one inline rather than
// needing a separate "add schedule" flow per site.
export async function listSchedules(): Promise<ScheduleRow[]> {
  const db = await getDb();
  const result = await db.query<ScheduleRow>(`
    SELECT w.Id AS WebsiteId, w.Name AS WebsiteName, w.Url AS WebsiteUrl,
      s.Id AS ScheduleId, s.Recurrence, s.Profile,
      CONVERT(VARCHAR(19), s.NextRunAt, 126) AS NextRunAt,
      CONVERT(VARCHAR(19), s.LastRunAt, 126) AS LastRunAt,
      s.IsActive
    FROM Websites w
    LEFT JOIN WordPressScanSchedules s ON s.WebsiteId = w.Id
    WHERE w.Enabled = 1 AND w.Platform = 'WordPress'
    ORDER BY w.Name
  `);
  return result.recordset;
}

// Upsert — one schedule per website (UNIQUE WebsiteId), so enabling/editing a site's cadence
// is always a single-row create-or-update, never a growing list to manage/dedupe.
export async function upsertSchedule(
  websiteId: number,
  recurrence: Recurrence,
  profile: ScanProfile,
  isActive: boolean,
  actor: AdminSession
): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("websiteId", sql.Int, websiteId).query<{ Id: number }>(
    "SELECT Id FROM WordPressScanSchedules WHERE WebsiteId = @websiteId"
  );

  if (existing.recordset[0]) {
    await db
      .request()
      .input("id", sql.Int, existing.recordset[0].Id)
      .input("recurrence", sql.VarChar, recurrence)
      .input("profile", sql.VarChar, profile)
      .input("isActive", sql.Bit, isActive)
      .query("UPDATE WordPressScanSchedules SET Recurrence = @recurrence, Profile = @profile, IsActive = @isActive WHERE Id = @id");
  } else {
    await db
      .request()
      .input("websiteId", sql.Int, websiteId)
      .input("recurrence", sql.VarChar, recurrence)
      .input("profile", sql.VarChar, profile)
      .input("isActive", sql.Bit, isActive)
      .input("next", sql.DateTime2, new Date())
      .input("uid", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query(
        `INSERT INTO WordPressScanSchedules (WebsiteId, Recurrence, Profile, NextRunAt, IsActive, CreatedByUserId, CreatedByUsername)
         VALUES (@websiteId, @recurrence, @profile, @next, @isActive, @uid, @by)`
      );
  }
}

export async function deleteSchedule(websiteId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("websiteId", sql.Int, websiteId).query("DELETE FROM WordPressScanSchedules WHERE WebsiteId = @websiteId");
}

// Called every ~10-15 minutes by scripts/run-wordpress-scan-schedules.ts (a longer interval
// than Security & Updates' 5-minute cadence — a WordPress deep scan is a real outbound scan
// against someone's site, heavier than queuing an install). Mirrors runDueSchedules() in
// src/lib/securityUpdates/installs.ts: each due row is claimed atomically via an
// Id+NextRunAt-matched UPDATE before anything runs, so overlapping runners can't double-scan.
export async function runDueWordPressScanSchedules(): Promise<{ due: number; scanned: number; skipped: number }> {
  const db = await getDb();
  const due = await db.query<{
    Id: number;
    WebsiteId: number;
    Name: string;
    Url: string;
    PhpVersion: string | null;
    Recurrence: Recurrence;
    Profile: ScanProfile;
    NextRunAt: Date;
    CreatedByUserId: number | null;
    CreatedByUsername: string | null;
  }>(`
    SELECT s.Id, s.WebsiteId, w.Name, w.Url, w.PhpVersion, s.Recurrence, s.Profile, s.NextRunAt, s.CreatedByUserId, s.CreatedByUsername
    FROM WordPressScanSchedules s
    JOIN Websites w ON w.Id = s.WebsiteId
    WHERE s.IsActive = 1 AND s.NextRunAt <= SYSUTCDATETIME()
  `);

  let scanned = 0;
  let skipped = 0;

  for (const row of due.recordset) {
    let next = advance(row.NextRunAt, row.Recurrence);
    // Catch-up: if the task runner was down long enough to miss several cycles, jump straight
    // to the next future slot instead of queuing a burst of overdue scans back-to-back.
    while (next.getTime() <= Date.now()) next = advance(next, row.Recurrence);

    const claim = await db
      .request()
      .input("id", sql.Int, row.Id)
      .input("old", sql.DateTime2, row.NextRunAt)
      .input("next", sql.DateTime2, next)
      .query("UPDATE WordPressScanSchedules SET LastRunAt = SYSUTCDATETIME(), NextRunAt = @next WHERE Id = @id AND NextRunAt = @old");
    if ((claim.rowsAffected[0] ?? 0) !== 1) continue; // another runner already claimed this one

    const actor = { userId: row.CreatedByUserId ?? 0, username: row.CreatedByUsername ?? "system:schedule" };
    try {
      const profile = isScanProfile(row.Profile) ? row.Profile : "standard";
      const report = await runWordPressDeepScan(row.Url, undefined, row.PhpVersion, profile);
      await saveWordPressScan(report, row.WebsiteId, actor);
      scanned++;
    } catch {
      skipped++;
    }
  }

  return { due: due.recordset.length, scanned, skipped };
}

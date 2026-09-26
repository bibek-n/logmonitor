import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { raiseAlertIfNew } from "@/lib/deviceAlerts";
import { agentSupportsUpdateInstall, MIN_UPDATE_INSTALL_AGENT_VERSION, SCAN_MAX_HEARTBEAT_AGE_SECONDS } from "./agentSupport";

// Admin-approved update installs and scheduled updates.
//
// The rule this module exists to enforce: DISRUPTIVE updates (OS-level, kernel, firmware, critical, or anything that needs a
// restart - DeviceUpdates.IsDisruptive) are never queued unless an administrator explicitly confirmed them, and the
// confirmation is recorded (who, when). The agent enforces the same rule again on the device (agent/updates_install.go).

export class InstallError extends Error {
  constructor(message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export const INSTALL_REQUEST_TTL_HOURS = 6;
export const MAX_KEYS_PER_REQUEST = 200;

export const SCHEDULE_CATEGORIES = ["security", "application", "package", "definition", "critical", "os", "kernel", "firmware", "driver"] as const;
export const SAFE_CATEGORIES = ["security", "application", "package", "definition"] as const;

export interface InstallActor {
  userId: number | null;
  username: string;
}

// ---- requesting an install ---------------------------------------------------------------------------

export interface InstallRequestResult {
  requestId: number;
  count: number;
  disruptiveCount: number;
}

export async function requestInstall(opts: {
  deviceId: string;
  updateKeys: string[];
  confirmDisruptive: boolean;
  actor: InstallActor;
  // For scheduled installs the confirmation was recorded when the schedule was created.
  confirmedBy?: { userId: number | null; name: string } | null;
  scheduleId?: number | null;
  actorLabel?: string;
}): Promise<InstallRequestResult> {
  const db = await getDb();

  const devRes = await db
    .request()
    .input("id", sql.VarChar, opts.deviceId)
    .query<{ Hostname: string; OS: string | null; AgentVersion: string | null; HbAge: number | null }>(
      "SELECT Hostname, OS, AgentVersion, DATEDIFF(SECOND, LastHeartbeat, SYSUTCDATETIME()) AS HbAge FROM Devices WHERE DeviceId = @id"
    );
  const dev = devRes.recordset[0];
  if (!dev) throw new InstallError("Device not found", 404);
  if (!["windows", "linux", "darwin"].includes(dev.OS ?? "")) throw new InstallError(`${dev.Hostname}: installing updates is not supported on this operating system`, 409);
  if (dev.HbAge === null || dev.HbAge > SCAN_MAX_HEARTBEAT_AGE_SECONDS) throw new InstallError(`${dev.Hostname} is offline - the agent is not reporting`, 409);
  if (!agentSupportsUpdateInstall(dev.AgentVersion)) throw new InstallError(`${dev.Hostname}: agent ${dev.AgentVersion ?? "unknown"} is too old to install updates (needs ${MIN_UPDATE_INSTALL_AGENT_VERSION}+)`, 409);

  const keys = Array.from(new Set(opts.updateKeys.map((k) => k.trim()).filter(Boolean)));
  if (keys.length === 0) throw new InstallError("Choose at least one update", 400);
  if (keys.length > MAX_KEYS_PER_REQUEST) throw new InstallError(`At most ${MAX_KEYS_PER_REQUEST} updates per request`, 400);

  const rq = db.request().input("deviceId", sql.VarChar, opts.deviceId);
  const names = keys.map((k, i) => {
    rq.input(`k${i}`, sql.NVarChar, k);
    return `@k${i}`;
  });
  const rows = await rq.query<{ UpdateKey: string; Title: string; Category: string; IsDisruptive: boolean; Status: string }>(
    `SELECT UpdateKey, Title, Category, IsDisruptive, Status FROM DeviceUpdates WHERE DeviceId = @deviceId AND UpdateKey IN (${names.join(",")})`
  );
  const byKey = new Map(rows.recordset.map((r) => [r.UpdateKey, r]));
  const notPending = keys.filter((k) => byKey.get(k)?.Status !== "Pending");
  if (notPending.length > 0) {
    throw new InstallError(`${notPending.length} of the selected update(s) are not pending on ${dev.Hostname} (already installed, or not found) - rescan and try again`, 400);
  }

  const disruptive = keys.map((k) => byKey.get(k)!).filter((r) => r.IsDisruptive);
  if (disruptive.length > 0 && !opts.confirmDisruptive) {
    throw new InstallError(
      `${disruptive.length} disruptive update(s) (OS, kernel, firmware, critical or restart-requiring) need administrator confirmation`,
      409,
      { confirmationRequired: true, items: disruptive.map((r) => ({ key: r.UpdateKey, title: r.Title, category: r.Category })) }
    );
  }

  const busy = await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .query("SELECT TOP 1 Id FROM PendingUpdateRequests WHERE DeviceId = @deviceId AND Kind = 'install' AND FulfilledAt IS NULL AND ExpiresAt > SYSUTCDATETIME()");
  if (busy.recordset.length > 0) throw new InstallError(`${dev.Hostname} already has an install queued or running - wait for it to finish`, 409);

  const allowDisruptive = disruptive.length > 0 && opts.confirmDisruptive;
  const confirmer = allowDisruptive ? opts.confirmedBy ?? { userId: opts.actor.userId, name: opts.actor.username } : null;

  const ins = await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .input("payload", sql.NVarChar(sql.MAX), JSON.stringify({ keys }))
    .input("allow", sql.Bit, allowDisruptive)
    .input("userId", sql.Int, opts.actor.userId)
    .input("by", sql.NVarChar, opts.actorLabel ?? opts.actor.username)
    .input("confUser", sql.Int, confirmer?.userId ?? null)
    .input("confName", sql.NVarChar, confirmer?.name ?? null)
    .input("scheduleId", sql.Int, opts.scheduleId ?? null)
    .input("ttl", sql.Int, INSTALL_REQUEST_TTL_HOURS)
    .query<{ Id: number }>(`INSERT INTO PendingUpdateRequests (DeviceId, Kind, PayloadJson, AllowDisruptive, RequestedByUserId, RequestedByName, ConfirmedByUserId, ConfirmedByName, ScheduleId, ExpiresAt)
      OUTPUT INSERTED.Id VALUES (@deviceId, 'install', @payload, @allow, @userId, @by, @confUser, @confName, @scheduleId, DATEADD(HOUR, @ttl, SYSUTCDATETIME()))`);
  const requestId = ins.recordset[0].Id;

  await db
    .request()
    .input("deviceId", sql.VarChar, opts.deviceId)
    .input("hostname", sql.NVarChar, dev.Hostname)
    .input("os", sql.VarChar, dev.OS)
    .input("detail", sql.NVarChar, `${keys.length} update(s) approved for install${disruptive.length ? `, ${disruptive.length} disruptive (confirmed by ${confirmer?.name})` : ""}`)
    .input("actor", sql.NVarChar, opts.actorLabel ?? opts.actor.username)
    .input("userId", sql.Int, opts.actor.userId)
    .input("requestId", sql.Int, requestId)
    .query(`INSERT INTO UpdateHistory (DeviceId, Hostname, OS, EventType, Detail, ActorUserId, ActorName, RequestId) VALUES (@deviceId, @hostname, @os, 'install_requested', @detail, @userId, @actor, @requestId)`);

  return { requestId, count: keys.length, disruptiveCount: disruptive.length };
}

// "Update" button on several devices: every pending update that is NOT disruptive, nothing else.
export async function requestSafeInstalls(deviceIds: string[], actor: InstallActor) {
  const db = await getDb();
  const queued: { deviceId: string; hostname: string; requestId: number; count: number }[] = [];
  const skipped: { deviceId: string; hostname: string; reason: string }[] = [];
  for (const deviceId of deviceIds) {
    const h = await db.request().input("id", sql.VarChar, deviceId).query<{ Hostname: string }>("SELECT Hostname FROM Devices WHERE DeviceId = @id");
    const hostname = h.recordset[0]?.Hostname ?? deviceId;
    const pending = await db
      .request()
      .input("id", sql.VarChar, deviceId)
      .query<{ UpdateKey: string }>("SELECT UpdateKey FROM DeviceUpdates WHERE DeviceId = @id AND Status = 'Pending' AND IsDisruptive = 0");
    if (pending.recordset.length === 0) {
      skipped.push({ deviceId, hostname, reason: "no non-disruptive updates pending" });
      continue;
    }
    try {
      const r = await requestInstall({ deviceId, updateKeys: pending.recordset.map((p) => p.UpdateKey).slice(0, MAX_KEYS_PER_REQUEST), confirmDisruptive: false, actor });
      queued.push({ deviceId, hostname, requestId: r.requestId, count: r.count });
    } catch (err) {
      skipped.push({ deviceId, hostname, reason: err instanceof Error ? err.message : "failed" });
    }
  }
  return { queued, skipped };
}

// ---- results reported by the agent ---------------------------------------------------------------------------

export const installResultSchema = z.object({
  requestId: z.number().int().positive(),
  status: z.enum(["running", "done", "failed", "partial", "refused", "interrupted"]),
  items: z
    .array(
      z.object({
        key: z.string().max(300),
        title: z.string().max(500).default(""),
        outcome: z.enum(["installed", "failed", "refused", "skipped"]),
        message: z.string().max(1000).default(""),
      })
    )
    .max(300)
    .default([]),
  rebootRequired: z.boolean().default(false),
  output: z.string().max(8000).default(""),
});

export async function ingestInstallResult(device: { deviceId: string; hostname: string }, body: z.infer<typeof installResultSchema>): Promise<{ ok: boolean; error?: string }> {
  const db = await getDb();
  const reqRes = await db
    .request()
    .input("id", sql.Int, body.requestId)
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ StartedAt: Date | null; FulfilledAt: Date | null; Expired: number; RequestedByName: string | null; RequestedByUserId: number | null }>(
      `SELECT StartedAt, FulfilledAt, CASE WHEN ExpiresAt > SYSUTCDATETIME() THEN 0 ELSE 1 END AS Expired, RequestedByName, RequestedByUserId
       FROM PendingUpdateRequests WHERE Id = @id AND DeviceId = @deviceId AND Kind = 'install'`
    );
  const r = reqRes.recordset[0];
  if (!r) return { ok: false, error: "Unknown install request" };
  if (r.FulfilledAt) return { ok: false, error: "This request is already finished" };

  const devInfo = await db.request().input("id", sql.VarChar, device.deviceId).query<{ OS: string | null }>("SELECT OS FROM Devices WHERE DeviceId = @id");
  const os = devInfo.recordset[0]?.OS ?? null;
  const actor = r.RequestedByName ?? "Administrator";

  const history = async (tx: sql.Transaction | null, event: string, detail: string, key?: string, title?: string, category?: string) => {
    const rq = tx ? new sql.Request(tx) : db.request();
    await rq
      .input("d", sql.VarChar, device.deviceId)
      .input("h", sql.NVarChar, device.hostname)
      .input("os", sql.VarChar, os)
      .input("e", sql.VarChar, event)
      .input("k", sql.NVarChar, key ?? null)
      .input("t", sql.NVarChar, title ?? null)
      .input("c", sql.VarChar, category ?? null)
      .input("detail", sql.NVarChar, detail.slice(0, 1000))
      .input("actor", sql.NVarChar, actor)
      .input("uid", sql.Int, r.RequestedByUserId)
      .input("rid", sql.Int, body.requestId)
      .query("INSERT INTO UpdateHistory (DeviceId, Hostname, OS, EventType, UpdateKey, Title, Category, Detail, ActorUserId, ActorName, RequestId) VALUES (@d, @h, @os, @e, @k, @t, @c, @detail, @uid, @actor, @rid)");
  };

  if (body.status === "running") {
    // At-most-once: the agent only starts installing if THIS succeeds, and it can succeed exactly once.
    if (r.StartedAt) return { ok: false, error: "This request was already started" };
    if (r.Expired) return { ok: false, error: "This request expired before it started" };
    const upd = await db
      .request()
      .input("id", sql.Int, body.requestId)
      .query("UPDATE PendingUpdateRequests SET StartedAt = SYSUTCDATETIME() WHERE Id = @id AND StartedAt IS NULL AND FulfilledAt IS NULL AND ExpiresAt > SYSUTCDATETIME()");
    if ((upd.rowsAffected[0] ?? 0) !== 1) return { ok: false, error: "This request can no longer be started" };
    await history(null, "install_started", "Approved update install started on the device");
    return { ok: true };
  }

  const installed = body.items.filter((i) => i.outcome === "installed").length;
  const failed = body.items.filter((i) => i.outcome === "failed").length;
  const refused = body.items.filter((i) => i.outcome === "refused").length;
  const skipped = body.items.filter((i) => i.outcome === "skipped").length;
  const summary = `${body.status}: ${installed} installed, ${failed} failed, ${refused} refused, ${skipped} skipped${body.rebootRequired ? " - restart required" : ""}`;

  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const upd = await new sql.Request(tx)
      .input("id", sql.Int, body.requestId)
      .input("status", sql.VarChar, body.status)
      .input("summary", sql.NVarChar, `${summary}${body.output ? ` | ${body.output.slice(-600)}` : ""}`.slice(0, 1000))
      .input("reboot", sql.Bit, body.rebootRequired)
      .query("UPDATE PendingUpdateRequests SET FulfilledAt = SYSUTCDATETIME(), ResultStatus = @status, ResultSummary = @summary, RebootRequired = @reboot WHERE Id = @id AND FulfilledAt IS NULL");
    if ((upd.rowsAffected[0] ?? 0) !== 1) {
      await tx.rollback();
      return { ok: false, error: "This request is already finished" };
    }

    for (const it of body.items) {
      await new sql.Request(tx)
        .input("rid", sql.Int, body.requestId)
        .input("d", sql.VarChar, device.deviceId)
        .input("k", sql.NVarChar, it.key)
        .input("t", sql.NVarChar, it.title || it.key)
        .input("o", sql.VarChar, it.outcome)
        .input("m", sql.NVarChar, it.message)
        .query("INSERT INTO UpdateInstallResults (RequestId, DeviceId, UpdateKey, Title, Outcome, Message) VALUES (@rid, @d, @k, @t, @o, @m)");

      if (it.outcome === "installed") {
        await new sql.Request(tx)
          .input("d", sql.VarChar, device.deviceId)
          .input("k", sql.NVarChar, it.key)
          .query("UPDATE DeviceUpdates SET Status = 'Installed', InstalledAt = SYSUTCDATETIME(), FailureMessage = NULL WHERE DeviceId = @d AND UpdateKey = @k");
      } else if (it.outcome === "failed") {
        await new sql.Request(tx)
          .input("d", sql.VarChar, device.deviceId)
          .input("k", sql.NVarChar, it.key)
          .input("m", sql.NVarChar, it.message.slice(0, 1000))
          .query("UPDATE DeviceUpdates SET FailureMessage = @m WHERE DeviceId = @d AND UpdateKey = @k");
      }
      const ev = it.outcome === "installed" ? "update_installed" : it.outcome === "failed" ? "update_install_failed" : it.outcome === "refused" ? "update_install_refused" : "update_install_skipped";
      await history(tx, ev, it.outcome === "installed" ? `Installed by approved request #${body.requestId}` : it.message, it.key, it.title || it.key);
    }
    await history(tx, "install_completed", summary);
    if (body.rebootRequired) await history(tx, "reboot_required", "A restart is required to finish installing updates (not performed automatically)");
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }

  if (failed > 0) {
    try {
      await raiseAlertIfNew(device.deviceId, "updates_failed", "warning", `${device.hostname}: ${failed} update(s) failed to install`);
    } catch (err) {
      console.error("update-result: alert step failed", err);
    }
  }
  return { ok: true };
}

// ---- reading requests -----------------------------------------------------------------------------------------

export async function listInstallRequests(deviceId: string | null, limit = 20) {
  const db = await getDb();
  const rq = db.request().input("limit", sql.Int, Math.min(100, Math.max(1, limit)));
  let where = "r.Kind = 'install'";
  if (deviceId) {
    rq.input("d", sql.VarChar, deviceId);
    where += " AND r.DeviceId = @d";
  }
  const reqs = await rq.query<{
    Id: number; DeviceId: string; Hostname: string | null; RequestedByName: string | null; ConfirmedByName: string | null; AllowDisruptive: boolean; ScheduleId: number | null;
    CreatedAt: string; StartedAt: string | null; FulfilledAt: string | null; ResultStatus: string | null; ResultSummary: string | null; RebootRequired: boolean | null; Expired: number;
  }>(`
    SELECT TOP (@limit) r.Id, r.DeviceId, d.Hostname, r.RequestedByName, r.ConfirmedByName, r.AllowDisruptive, r.ScheduleId,
      CONVERT(VARCHAR(19), r.CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), r.StartedAt, 126) AS StartedAt, CONVERT(VARCHAR(19), r.FulfilledAt, 126) AS FulfilledAt,
      r.ResultStatus, r.ResultSummary, r.RebootRequired, CASE WHEN r.ExpiresAt > SYSUTCDATETIME() THEN 0 ELSE 1 END AS Expired
    FROM PendingUpdateRequests r LEFT JOIN Devices d ON d.DeviceId = r.DeviceId WHERE ${where} ORDER BY r.CreatedAt DESC, r.Id DESC`);
  if (reqs.recordset.length === 0) return [];
  const ids = reqs.recordset.map((r) => r.Id);
  const items = await db.query<{ RequestId: number; UpdateKey: string; Title: string; Outcome: string; Message: string | null }>(
    `SELECT RequestId, UpdateKey, Title, Outcome, Message FROM UpdateInstallResults WHERE RequestId IN (${ids.join(",")}) ORDER BY Id`
  );
  return reqs.recordset.map((r) => {
    let status: string;
    if (r.FulfilledAt) status = r.ResultStatus ?? "done";
    else if (r.StartedAt) status = r.Expired ? "interrupted" : "running";
    else status = r.Expired ? "expired" : "queued";
    return {
      id: r.Id,
      deviceId: r.DeviceId,
      hostname: r.Hostname,
      requestedBy: r.RequestedByName,
      confirmedBy: r.ConfirmedByName,
      disruptiveAllowed: !!r.AllowDisruptive,
      scheduleId: r.ScheduleId,
      createdAt: r.CreatedAt,
      startedAt: r.StartedAt,
      finishedAt: r.FulfilledAt,
      status,
      summary: r.ResultSummary,
      rebootRequired: r.RebootRequired,
      items: items.recordset.filter((i) => i.RequestId === r.Id).map((i) => ({ key: i.UpdateKey, title: i.Title, outcome: i.Outcome, message: i.Message })),
    };
  });
}

// ---- schedules -------------------------------------------------------------------------------------------------

export const scheduleSchema = z.object({
  name: z.string().min(1).max(200),
  deviceIds: z.array(z.string().min(1).max(40)).min(1).max(200),
  categories: z.array(z.enum(SCHEDULE_CATEGORIES)).min(1),
  includeDisruptive: z.boolean().default(false),
  // The explicit "I confirm disruptive updates for this window" checkbox. Required whenever includeDisruptive is set.
  confirmDisruptive: z.boolean().default(false),
  recurrence: z.enum(["once", "weekly"]),
  runAt: z.string().min(10).max(40), // ISO-8601 instant (UTC) of the first / only run
});

export async function createSchedule(input: z.infer<typeof scheduleSchema>, actor: InstallActor): Promise<number> {
  const runAt = new Date(input.runAt);
  if (Number.isNaN(runAt.getTime())) throw new InstallError("Choose a valid date and time", 400);
  if (runAt.getTime() < Date.now() - 60_000) throw new InstallError("Choose a time in the future", 400);
  if (input.includeDisruptive && !input.confirmDisruptive) {
    throw new InstallError("Including disruptive updates (OS, kernel, firmware, critical, restart-requiring) needs your explicit confirmation", 409, { confirmationRequired: true });
  }
  const categories = input.categories.filter((c) => input.includeDisruptive || (SAFE_CATEGORIES as readonly string[]).includes(c));
  if (categories.length === 0) throw new InstallError("Choose at least one update type (disruptive types need the confirmation checkbox)", 400);

  const db = await getDb();
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const rq = new sql.Request(tx);
    const names = input.deviceIds.map((id, i) => {
      rq.input(`d${i}`, sql.VarChar, id);
      return `@d${i}`;
    });
    const found = await rq.query<{ DeviceId: string }>(`SELECT DeviceId FROM Devices WHERE DeviceId IN (${names.join(",")})`);
    if (found.recordset.length !== input.deviceIds.length) throw new InstallError("One or more selected devices no longer exist", 400);

    const ins = await new sql.Request(tx)
      .input("name", sql.NVarChar, input.name.trim())
      .input("rec", sql.VarChar, input.recurrence)
      .input("next", sql.DateTime2, runAt)
      .input("cats", sql.NVarChar, categories.join(","))
      .input("disr", sql.Bit, input.includeDisruptive)
      .input("uid", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query<{ Id: number }>(`INSERT INTO UpdateSchedules (Name, Recurrence, NextRunAt, Categories, IncludeDisruptive, ConfirmedByUserId, ConfirmedByName, ConfirmedAt, CreatedByUserId, CreatedByName)
        OUTPUT INSERTED.Id VALUES (@name, @rec, @next, @cats, @disr, ${input.includeDisruptive ? "@uid, @by, SYSUTCDATETIME()" : "NULL, NULL, NULL"}, @uid, @by)`);
    const id = ins.recordset[0].Id;
    for (const d of input.deviceIds) {
      await new sql.Request(tx).input("s", sql.Int, id).input("d", sql.VarChar, d).query("INSERT INTO UpdateScheduleTargets (ScheduleId, DeviceId) VALUES (@s, @d)");
    }
    await new sql.Request(tx)
      .input("detail", sql.NVarChar, `Schedule "${input.name.trim()}" created: ${input.recurrence} from ${runAt.toISOString()}, ${input.deviceIds.length} device(s), types ${categories.join("/")}${input.includeDisruptive ? " - DISRUPTIVE updates included with administrator confirmation" : ""}`.slice(0, 1000))
      .input("uid", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query("INSERT INTO UpdateHistory (EventType, Detail, ActorUserId, ActorName) VALUES ('schedule_created', @detail, @uid, @by)");
    await tx.commit();
    return id;
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export async function listSchedules() {
  const db = await getDb();
  const rows = await db.query<{
    Id: number; Name: string; Recurrence: string; NextRunAt: string | null; Categories: string; IncludeDisruptive: boolean; ConfirmedByName: string | null;
    IsActive: boolean; LastRunAt: string | null; LastRunSummary: string | null; CreatedByName: string | null; DeviceCount: number; Devices: string | null;
  }>(`
    SELECT s.Id, s.Name, s.Recurrence, CONVERT(VARCHAR(19), s.NextRunAt, 126) AS NextRunAt, s.Categories, s.IncludeDisruptive, s.ConfirmedByName, s.IsActive,
      CONVERT(VARCHAR(19), s.LastRunAt, 126) AS LastRunAt, s.LastRunSummary, s.CreatedByName,
      (SELECT COUNT(*) FROM UpdateScheduleTargets t WHERE t.ScheduleId = s.Id) AS DeviceCount,
      (SELECT STRING_AGG(x.Label, ', ') FROM (SELECT TOP 5 COALESCE(d.DeviceName, d.Hostname) AS Label FROM UpdateScheduleTargets t JOIN Devices d ON d.DeviceId = t.DeviceId WHERE t.ScheduleId = s.Id ORDER BY d.Hostname) x) AS Devices
    FROM UpdateSchedules s WHERE s.IsDeleted = 0 ORDER BY s.IsActive DESC, s.NextRunAt`);
  return rows.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    recurrence: r.Recurrence,
    nextRunAt: r.NextRunAt,
    categories: r.Categories.split(","),
    includeDisruptive: !!r.IncludeDisruptive,
    confirmedBy: r.ConfirmedByName,
    isActive: !!r.IsActive,
    lastRunAt: r.LastRunAt,
    lastRunSummary: r.LastRunSummary,
    createdBy: r.CreatedByName,
    deviceCount: r.DeviceCount,
    devices: r.Devices,
  }));
}

export async function setScheduleActive(id: number, active: boolean) {
  const db = await getDb();
  const r = await db.request().input("id", sql.Int, id).input("a", sql.Bit, active).query("UPDATE UpdateSchedules SET IsActive = @a WHERE Id = @id AND IsDeleted = 0");
  if ((r.rowsAffected[0] ?? 0) === 0) throw new InstallError("Schedule not found", 404);
}

export async function deleteSchedule(id: number) {
  const db = await getDb();
  const r = await db.request().input("id", sql.Int, id).query("UPDATE UpdateSchedules SET IsDeleted = 1, IsActive = 0 WHERE Id = @id AND IsDeleted = 0");
  if ((r.rowsAffected[0] ?? 0) === 0) throw new InstallError("Schedule not found", 404);
}

// Called every few minutes by scripts/run-update-schedules.ts. Each due schedule is claimed atomically (so overlapping
// runs can't double-queue), then every target device gets ONE install request for its matching pending updates.
export async function runDueSchedules(): Promise<{ schedules: number; queued: number; skipped: number }> {
  const db = await getDb();
  const due = await db.query<{ Id: number; Name: string; Recurrence: string; NextRunAt: Date; Categories: string; IncludeDisruptive: boolean; ConfirmedByUserId: number | null; ConfirmedByName: string | null; CreatedByUserId: number | null }>(
    "SELECT Id, Name, Recurrence, NextRunAt, Categories, IncludeDisruptive, ConfirmedByUserId, ConfirmedByName, CreatedByUserId FROM UpdateSchedules WHERE IsActive = 1 AND IsDeleted = 0 AND NextRunAt <= SYSUTCDATETIME()"
  );
  let totalQueued = 0;
  let totalSkipped = 0;

  for (const s of due.recordset) {
    let next: Date | null = null;
    if (s.Recurrence === "weekly") {
      next = new Date(s.NextRunAt.getTime());
      while (next.getTime() <= Date.now()) next = new Date(next.getTime() + 7 * 24 * 3600 * 1000);
    }
    const claim = await db
      .request()
      .input("id", sql.Int, s.Id)
      .input("old", sql.DateTime2, s.NextRunAt)
      .input("next", sql.DateTime2, next)
      .input("active", sql.Bit, next !== null)
      .query("UPDATE UpdateSchedules SET LastRunAt = SYSUTCDATETIME(), NextRunAt = @next, IsActive = @active WHERE Id = @id AND IsActive = 1 AND NextRunAt = @old");
    if ((claim.rowsAffected[0] ?? 0) !== 1) continue; // another runner took it

    const label = `Schedule: ${s.Name}`;
    const targets = await db.request().input("id", sql.Int, s.Id).query<{ DeviceId: string; Hostname: string }>(
      "SELECT t.DeviceId, d.Hostname FROM UpdateScheduleTargets t JOIN Devices d ON d.DeviceId = t.DeviceId WHERE t.ScheduleId = @id"
    );
    const cats = s.Categories.split(",").filter(Boolean);
    let queued = 0;
    const skips: string[] = [];

    for (const t of targets.recordset) {
      try {
        const rq = db.request().input("d", sql.VarChar, t.DeviceId);
        const names = cats.map((c, i) => {
          rq.input(`c${i}`, sql.VarChar, c);
          return `@c${i}`;
        });
        const pending = await rq.query<{ UpdateKey: string }>(
          `SELECT UpdateKey FROM DeviceUpdates WHERE DeviceId = @d AND Status = 'Pending' AND Category IN (${names.join(",")})${s.IncludeDisruptive ? "" : " AND IsDisruptive = 0"}`
        );
        if (pending.recordset.length === 0) {
          skips.push(`${t.Hostname}: nothing matching`);
          continue;
        }
        await requestInstall({
          deviceId: t.DeviceId,
          updateKeys: pending.recordset.map((p) => p.UpdateKey).slice(0, MAX_KEYS_PER_REQUEST),
          confirmDisruptive: !!s.IncludeDisruptive,
          confirmedBy: s.IncludeDisruptive ? { userId: s.ConfirmedByUserId, name: s.ConfirmedByName ?? "administrator" } : null,
          actor: { userId: s.CreatedByUserId, username: label },
          actorLabel: label,
          scheduleId: s.Id,
        });
        queued++;
      } catch (err) {
        skips.push(`${t.Hostname}: ${err instanceof InstallError ? err.message : "failed"}`);
      }
    }

    const summary = `${queued} device(s) queued${skips.length ? `; ${skips.length} skipped - ${skips.slice(0, 3).join("; ")}${skips.length > 3 ? "..." : ""}` : ""}`.slice(0, 500);
    await db.request().input("id", sql.Int, s.Id).input("sum", sql.NVarChar, summary).query("UPDATE UpdateSchedules SET LastRunSummary = @sum WHERE Id = @id");
    await db.request().input("d", sql.NVarChar, `${summary}`).input("actor", sql.NVarChar, label).input("uid", sql.Int, s.CreatedByUserId)
      .query("INSERT INTO UpdateHistory (EventType, Detail, ActorUserId, ActorName) VALUES ('schedule_run', @d, @uid, @actor)");
    totalQueued += queued;
    totalSkipped += skips.length;
  }
  return { schedules: due.recordset.length, queued: totalQueued, skipped: totalSkipped };
}

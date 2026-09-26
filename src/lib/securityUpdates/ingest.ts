import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { raiseAlertIfNew, resolveAlert } from "@/lib/deviceAlerts";

// Turns one agent scan (POST /api/agent/update-scan) into: the device's current update list
// (DeviceUpdates), a scan summary row (DeviceUpdateScans) and history events (UpdateHistory).

const CATEGORIES = ["os", "security", "critical", "application", "package", "kernel", "firmware", "driver", "definition"] as const;

const updateItemSchema = z.object({
  key: z.string().min(1).max(300),
  title: z.string().max(500).default(""),
  category: z.enum(CATEGORIES).catch("package"),
  severity: z.string().max(12).default("none"),
  currentVersion: z.string().max(100).nullish(),
  newVersion: z.string().max(100).nullish(),
  sizeMB: z.number().nullish(),
  requiresReboot: z.boolean().default(false),
  isDisruptive: z.boolean().default(false),
});

const failedItemSchema = z.object({
  key: z.string().min(1).max(300),
  title: z.string().max(500).default(""),
  error: z.string().max(1000).default(""),
  at: z.string().max(40).nullish(),
});

export const scanSchema = z.object({
  scannedAt: z.string().max(40).nullish(),
  os: z.string().max(20).nullish(),
  family: z.string().max(30).nullish(),
  supported: z.boolean().default(true),
  complete: z.boolean().default(true),
  rebootRequired: z.boolean().default(false),
  lastInstalledAt: z.string().max(40).nullish(),
  definitions: z
    .object({ name: z.string().max(100).default(""), version: z.string().max(100).default(""), ageDays: z.number().int().nullish() })
    .nullish(),
  updates: z.array(updateItemSchema).max(2000).default([]),
  failed: z.array(failedItemSchema).max(200).default([]),
  warnings: z.array(z.string().max(300)).max(50).default([]),
  trigger: z.enum(["scheduled", "admin"]).catch("scheduled"),
  requestId: z.number().int().nullish(),
});

export type UpdateScanPayload = z.infer<typeof scanSchema>;

function trunc(s: string | null | undefined, n: number): string | null {
  if (s == null) return null;
  return s.length > n ? s.slice(0, n) : s;
}

// More than this many brand-new updates in one scan (a first scan of a long-unpatched machine) are
// summarised in ONE history event instead of one event each, so history stays readable.
const PER_UPDATE_HISTORY_LIMIT = 25;

export async function ingestUpdateScan(device: { deviceId: string; hostname: string }, scan: UpdateScanPayload): Promise<void> {
  const db = await getDb();

  const info = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ OS: string | null }>("SELECT OS FROM Devices WHERE DeviceId = @deviceId");
  const os = info.recordset[0]?.OS ?? scan.os ?? null;

  let actorName = "Agent (scheduled scan)";
  let actorUserId: number | null = null;
  if (scan.requestId) {
    const req = await db
      .request()
      .input("id", sql.Int, scan.requestId)
      .input("deviceId", sql.VarChar, device.deviceId)
      .query<{ RequestedByName: string | null; RequestedByUserId: number | null }>(
        "SELECT RequestedByName, RequestedByUserId FROM PendingUpdateRequests WHERE Id = @id AND DeviceId = @deviceId"
      );
    if (req.recordset[0]) {
      actorName = req.recordset[0].RequestedByName ?? "Administrator";
      actorUserId = req.recordset[0].RequestedByUserId;
    }
  }

  const tally = (cat: string) => scan.updates.filter((u) => u.category === cat).length;
  const counts = {
    pending: scan.updates.length,
    security: tally("security"),
    critical: scan.updates.filter((u) => u.category === "critical" || u.severity === "critical").length,
    kernel: tally("kernel"),
    firmware: tally("firmware"),
    driver: tally("driver"),
    application: tally("application"),
    pkg: tally("package"),
    failed: scan.failed.length,
  };

  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const rq = () => new sql.Request(tx);

    const prevScan = await rq()
      .input("deviceId", sql.VarChar, device.deviceId)
      .query<{ RebootRequired: boolean }>("SELECT TOP 1 RebootRequired FROM DeviceUpdateScans WHERE DeviceId = @deviceId AND Complete = 1 ORDER BY ScannedAt DESC");
    const wasRebootRequired = prevScan.recordset[0]?.RebootRequired === true;

    const history: { event: string; key?: string | null; title?: string | null; category?: string | null; detail: string }[] = [];

    if (scan.supported && scan.complete) {
      const existingRows = await rq()
        .input("deviceId", sql.VarChar, device.deviceId)
        .query<{ UpdateKey: string; Status: string; Title: string; Category: string }>(
          "SELECT UpdateKey, Status, Title, Category FROM DeviceUpdates WHERE DeviceId = @deviceId"
        );
      const existing = new Map(existingRows.recordset.map((r) => [r.UpdateKey, r]));
      const currentKeys = new Set<string>([...scan.updates.map((u) => u.key), ...scan.failed.map((f) => f.key)]);

      // Anything that was pending/failed and is no longer reported has been installed, superseded or cleared.
      for (const row of existingRows.recordset) {
        if (currentKeys.has(row.UpdateKey) || !["Pending", "Deferred", "Failed"].includes(row.Status)) continue;
        await rq()
          .input("deviceId", sql.VarChar, device.deviceId)
          .input("key", sql.NVarChar, row.UpdateKey)
          .query("UPDATE DeviceUpdates SET Status = 'Installed', InstalledAt = SYSUTCDATETIME(), LastSeenAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId AND UpdateKey = @key");
        history.push({
          event: "update_installed",
          key: row.UpdateKey,
          title: row.Title,
          category: row.Category,
          detail: row.Status === "Failed" ? "Failure no longer reported" : "No longer pending (installed or superseded)",
        });
      }

      const newOnes: typeof scan.updates = [];
      for (const u of scan.updates) {
        const prev = existing.get(u.key);
        const revived = prev !== undefined && prev.Status === "Installed";
        const isNew = prev === undefined || revived;
        if (isNew) newOnes.push(u);
        const r = rq()
          .input("deviceId", sql.VarChar, device.deviceId)
          .input("key", sql.NVarChar, u.key)
          .input("title", sql.NVarChar, trunc(u.title || u.key, 500))
          .input("category", sql.VarChar, u.category)
          .input("severity", sql.VarChar, u.severity || "none")
          .input("cur", sql.NVarChar, trunc(u.currentVersion, 100))
          .input("new", sql.NVarChar, trunc(u.newVersion, 100))
          .input("size", sql.Decimal(10, 1), u.sizeMB ?? null)
          .input("reboot", sql.Bit, u.requiresReboot)
          .input("disruptive", sql.Bit, u.isDisruptive);
        if (prev === undefined) {
          await r.query(`INSERT INTO DeviceUpdates (DeviceId, UpdateKey, Title, Category, Severity, CurrentVersion, NewVersion, SizeMB, RequiresReboot, IsDisruptive, Status)
            VALUES (@deviceId, @key, @title, @category, @severity, @cur, @new, @size, @reboot, @disruptive, 'Pending')`);
        } else {
          await r.query(`UPDATE DeviceUpdates SET Title = @title, Category = @category, Severity = @severity, CurrentVersion = @cur, NewVersion = @new,
              SizeMB = @size, RequiresReboot = @reboot, IsDisruptive = @disruptive, Status = CASE WHEN Status = 'Deferred' THEN 'Deferred' ELSE 'Pending' END,
              FailureMessage = NULL, LastSeenAt = SYSUTCDATETIME(),
              FirstSeenAt = CASE WHEN Status = 'Installed' THEN SYSUTCDATETIME() ELSE FirstSeenAt END, InstalledAt = NULL
            WHERE DeviceId = @deviceId AND UpdateKey = @key`);
        }
      }
      if (newOnes.length > PER_UPDATE_HISTORY_LIMIT) {
        const secs = newOnes.filter((u) => u.category === "security" || u.category === "critical").length;
        history.push({ event: "update_found", detail: `${newOnes.length} new updates found (${secs} security/critical)` });
      } else {
        for (const u of newOnes) {
          history.push({ event: "update_found", key: u.key, title: u.title || u.key, category: u.category, detail: `${u.newVersion ?? ""}${u.severity && u.severity !== "none" ? ` - ${u.severity}` : ""}`.replace(/^ - /, "") });
        }
      }

      for (const f of scan.failed) {
        const prev = existing.get(f.key);
        const alreadyFailed = prev !== undefined && prev.Status === "Failed";
        const r = rq()
          .input("deviceId", sql.VarChar, device.deviceId)
          .input("key", sql.NVarChar, f.key)
          .input("title", sql.NVarChar, trunc(f.title || f.key, 500))
          .input("msg", sql.NVarChar, trunc(f.error, 1000));
        if (prev === undefined) {
          await r.query(`INSERT INTO DeviceUpdates (DeviceId, UpdateKey, Title, Category, Severity, Status, FailureMessage, IsDisruptive)
            VALUES (@deviceId, @key, @title, 'os', 'none', 'Failed', @msg, 0)`);
        } else {
          await r.query(`UPDATE DeviceUpdates SET Title = @title, Status = 'Failed', FailureMessage = @msg, LastSeenAt = SYSUTCDATETIME(), InstalledAt = NULL
            WHERE DeviceId = @deviceId AND UpdateKey = @key`);
        }
        if (!alreadyFailed) history.push({ event: "update_failed", key: f.key, title: f.title || f.key, category: "os", detail: f.error });
      }
    }

    if (scan.supported && scan.complete && scan.rebootRequired && !wasRebootRequired) {
      history.push({ event: "reboot_required", detail: "A restart is required to finish installing updates" });
    }

    const summary =
      !scan.supported
        ? "Scanning is not supported on this device"
        : `${counts.pending} pending (${counts.security} security, ${counts.critical} critical), ${counts.failed} failed${scan.rebootRequired ? ", restart required" : ""}${scan.complete ? "" : " - scan incomplete"}`;
    history.push({ event: "scan_completed", detail: trunc(summary + (scan.warnings.length ? ` | ${scan.warnings[0]}` : ""), 1000) ?? summary });

    await rq()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("trigger", sql.VarChar, scan.trigger)
      .input("family", sql.VarChar, trunc(scan.family, 30))
      .input("supported", sql.Bit, scan.supported)
      .input("complete", sql.Bit, scan.complete)
      .input("reboot", sql.Bit, scan.rebootRequired)
      .input("pending", sql.Int, counts.pending)
      .input("security", sql.Int, counts.security)
      .input("critical", sql.Int, counts.critical)
      .input("kernel", sql.Int, counts.kernel)
      .input("firmware", sql.Int, counts.firmware)
      .input("driver", sql.Int, counts.driver)
      .input("application", sql.Int, counts.application)
      .input("pkg", sql.Int, counts.pkg)
      .input("failed", sql.Int, counts.failed)
      .input("lastInstalled", sql.VarChar, trunc(scan.lastInstalledAt, 40))
      .input("defName", sql.NVarChar, trunc(scan.definitions?.name, 100))
      .input("defVersion", sql.NVarChar, trunc(scan.definitions?.version, 100))
      .input("defAge", sql.Int, scan.definitions?.ageDays ?? null)
      .input("warnings", sql.NVarChar(sql.MAX), scan.warnings.length ? JSON.stringify(scan.warnings) : null)
      .query(`INSERT INTO DeviceUpdateScans (DeviceId, TriggerType, Family, Supported, Complete, RebootRequired, PendingCount, SecurityCount, CriticalCount, KernelCount,
          FirmwareCount, DriverCount, ApplicationCount, PackageCount, FailedCount, LastInstalledAt, DefinitionsName, DefinitionsVersion, DefinitionsAgeDays, WarningsJson)
        VALUES (@deviceId, @trigger, @family, @supported, @complete, @reboot, @pending, @security, @critical, @kernel, @firmware, @driver, @application, @pkg, @failed,
          @lastInstalled, @defName, @defVersion, @defAge, @warnings)`);

    for (const h of history) {
      await rq()
        .input("deviceId", sql.VarChar, device.deviceId)
        .input("hostname", sql.NVarChar, device.hostname)
        .input("os", sql.VarChar, os)
        .input("event", sql.VarChar, h.event)
        .input("key", sql.NVarChar, trunc(h.key ?? null, 300))
        .input("title", sql.NVarChar, trunc(h.title ?? null, 500))
        .input("category", sql.VarChar, h.category ?? null)
        .input("detail", sql.NVarChar, trunc(h.detail, 1000))
        .input("actor", sql.NVarChar, actorName)
        .input("actorId", sql.Int, actorUserId)
        .input("requestId", sql.Int, scan.requestId ?? null)
        .query(`INSERT INTO UpdateHistory (DeviceId, Hostname, OS, EventType, UpdateKey, Title, Category, Detail, ActorUserId, ActorName, RequestId)
          VALUES (@deviceId, @hostname, @os, @event, @key, @title, @category, @detail, @actorId, @actor, @requestId)`);
    }

    if (scan.requestId) {
      await rq()
        .input("id", sql.Int, scan.requestId)
        .input("deviceId", sql.VarChar, device.deviceId)
        .input("status", sql.VarChar, scan.complete && scan.supported ? "Done" : "Incomplete")
        .query("UPDATE PendingUpdateRequests SET FulfilledAt = SYSUTCDATETIME(), ResultStatus = @status WHERE Id = @id AND DeviceId = @deviceId AND FulfilledAt IS NULL");
    }

    // Keep the older single-value columns (Servers page / compliance patch check) in step when the scan is trustworthy.
    if (scan.supported && scan.complete) {
      try {
        await rq()
          .input("deviceId", sql.VarChar, device.deviceId)
          .input("reboot", sql.Bit, scan.rebootRequired)
          .query("UPDATE Devices SET RebootPending = @reboot WHERE DeviceId = @deviceId");
      } catch {
        /* column only exists on servers that ran migrate-servers-health - not fatal */
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }

  // Dashboard-bell alerts: best effort, never fail the ingest.
  try {
    if (scan.supported && scan.complete) {
      if (counts.critical > 0) {
        await raiseAlertIfNew(device.deviceId, "critical_updates_pending", "warning", `${device.hostname}: ${counts.critical} critical update(s) pending`);
      } else {
        await resolveAlert(device.deviceId, "critical_updates_pending");
      }
      if (counts.failed > 0) {
        await raiseAlertIfNew(device.deviceId, "updates_failed", "warning", `${device.hostname}: ${counts.failed} update(s) failed to install`);
      } else {
        await resolveAlert(device.deviceId, "updates_failed");
      }
    }
  } catch (err) {
    console.error("update-scan: alert step failed", err);
  }
}

import { getDb, sql } from "./db";

// Avoids duplicate spam: only inserts a new DeviceAlerts row if there isn't already an
// unresolved alert of the same type for this device. Called inline from the metrics and
// security-status routes right when a threshold is crossed — no separate poller needed.
export async function raiseAlertIfNew(deviceId: string, alertType: string, severity: "info" | "warning" | "critical", message: string) {
  const db = await getDb();
  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("alertType", sql.VarChar, alertType)
    .query("SELECT 1 FROM DeviceAlerts WHERE DeviceId = @deviceId AND AlertType = @alertType AND ResolvedAt IS NULL");

  if (existing.recordset.length > 0) return;

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("alertType", sql.VarChar, alertType)
    .input("severity", sql.VarChar, severity)
    .input("message", sql.NVarChar, message)
    .query("INSERT INTO DeviceAlerts (DeviceId, AlertType, Severity, Message) VALUES (@deviceId, @alertType, @severity, @message)");
}

// For discrete one-off events (a USB device was just plugged in or removed) rather than
// an ongoing condition - raiseAlertIfNew's "skip if already unresolved" dedup would wrongly
// swallow every event after the first for a given device, since nothing would ever clear
// it. Each call always inserts its own row, marked resolved immediately (there's no
// "cleared" state to wait for), and getRecentAlerts surfaces recently-triggered rows of
// these types for a while even though they're resolved - see src/lib/alerts.ts.
export async function raisePointInTimeAlert(deviceId: string, alertType: string, severity: "info" | "warning" | "critical", message: string) {
  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("alertType", sql.VarChar, alertType)
    .input("severity", sql.VarChar, severity)
    .input("message", sql.NVarChar, message)
    .query(
      "INSERT INTO DeviceAlerts (DeviceId, AlertType, Severity, Message, ResolvedAt) VALUES (@deviceId, @alertType, @severity, @message, SYSUTCDATETIME())"
    );
}

// Marks any unresolved alert of this type for the device as resolved, once the
// underlying condition clears (e.g. CPU usage drops back below the threshold).
export async function resolveAlert(deviceId: string, alertType: string) {
  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("alertType", sql.VarChar, alertType)
    .query("UPDATE DeviceAlerts SET ResolvedAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId AND AlertType = @alertType AND ResolvedAt IS NULL");
}

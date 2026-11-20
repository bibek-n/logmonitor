import { getDb, sql } from "./db";
import { publishRealtimeEvent } from "./realtime/eventBus";

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
  publishRealtimeEvent({ type: "alert" });
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
  publishRealtimeEvent({ type: "alert" });
}

// Best-effort alert for an admin chat message that genuinely failed to send (DB error,
// staff row vanished mid-request) - not for ordinary input validation (empty/too-long
// message), which the client already guards against. Looks up the staff member's agent
// device, since DeviceAlerts rows only surface in the bell when they join to a real
// Devices row; if the staff member has no agent device, the alert is skipped rather than
// written invisibly. Never throws - alerting must not break the chat response itself.
export async function raiseChatSendFailureAlert(staffId: number, reason: string) {
  try {
    const db = await getDb();
    const dev = await db
      .request()
      .input("staffId", sql.Int, staffId)
      .query<{ DeviceId: string }>("SELECT TOP 1 DeviceId FROM Devices WHERE StaffId = @staffId");
    const deviceId = dev.recordset[0]?.DeviceId;
    if (!deviceId) return;
    await raisePointInTimeAlert(deviceId, "chat_send_failed", "warning", `Admin chat message failed to send: ${reason}`);
  } catch {
    /* alerting is best-effort */
  }
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

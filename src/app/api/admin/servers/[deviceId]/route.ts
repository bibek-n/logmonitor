import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const VALID_STATUS = new Set(["Pending", "Active", "Maintenance", "Decommissioned"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const status = typeof body.status === "string" && VALID_STATUS.has(body.status) ? body.status : null;

  const db = await getDb();
  const existing = await db.request().input("deviceId", sql.VarChar, deviceId).query("SELECT 1 FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'");
  if (existing.recordset.length === 0) {
    return NextResponse.json({ ok: false, error: "Server not found" }, { status: 404 });
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("deviceName", sql.NVarChar, str(body.deviceName))
    .input("serverRole", sql.NVarChar, str(body.serverRole))
    .input("staticIpAddress", sql.VarChar, str(body.ipAddress))
    .input("macAddress", sql.VarChar, str(body.macAddress))
    .input("status", sql.NVarChar, status)
    .query(`
      UPDATE Devices SET
        DeviceName = COALESCE(@deviceName, DeviceName),
        ServerRole = COALESCE(@serverRole, ServerRole),
        StaticIpAddress = COALESCE(@staticIpAddress, StaticIpAddress),
        MacAddress = COALESCE(@macAddress, MacAddress),
        LifecycleStatus = COALESCE(@status, LifecycleStatus)
      WHERE DeviceId = @deviceId
    `);

  await logAdminAction({ admin, section: "servers", action: "update_server", details: deviceId, req });

  return NextResponse.json({ ok: true });
}

// Tables with a foreign key on Devices(DeviceId) — deleted in dependency order before the
// Devices row itself so this never trips an FK constraint violation. ScreenshotAuditLog
// references Screenshots.Id (not Devices directly), so it must go before Screenshots.
// EnrollmentTokens.PreCreatedDeviceId/UsedByDeviceId have no FK constraint (by design —
// tokens are allowed to outlive/orphan from a deleted device), so nothing to clean there.
const CHILD_TABLE_DELETES = [
  "DELETE FROM ScreenshotAuditLog WHERE ScreenshotId IN (SELECT Id FROM Screenshots WHERE DeviceId = @deviceId)",
  "DELETE FROM Screenshots WHERE DeviceId = @deviceId",
  "DELETE FROM PendingScreenshotRequests WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceMetrics WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceHardwareInfo WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceSecurityStatus WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceNetworkInfo WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceProcessSnapshot WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceServiceSnapshot WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceSoftwareSnapshot WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceUsbEvents WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceAlerts WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceDisks WHERE DeviceId = @deviceId",
  "DELETE FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId",
  "DELETE FROM ServerLogEntries WHERE DeviceId = @deviceId",
];

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { deviceId } = await params;
  const db = await getDb();

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ DeviceName: string | null; Hostname: string }>("SELECT DeviceName, Hostname FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'");
  const server = existing.recordset[0];
  if (!server) {
    return NextResponse.json({ ok: false, error: "Server not found" }, { status: 404 });
  }

  for (const query of CHILD_TABLE_DELETES) {
    await db.request().input("deviceId", sql.VarChar, deviceId).query(query);
  }
  await db.request().input("deviceId", sql.VarChar, deviceId).query("DELETE FROM Devices WHERE DeviceId = @deviceId");

  await logAdminAction({
    admin,
    section: "servers",
    action: "delete_server",
    details: `${server.DeviceName ?? server.Hostname ?? deviceId}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

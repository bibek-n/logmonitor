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

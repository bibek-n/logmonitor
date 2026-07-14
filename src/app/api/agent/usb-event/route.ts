import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const VALID_EVENT_TYPES = new Set(["insert", "removal"]);

// Detection/audit only — there's no allow/block policy in this phase, so this
// deliberately doesn't raise a DeviceAlerts row (that would imply something needs
// attention, which isn't true without a policy to violate). The event is still fully
// recorded for the device's USB history list.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !VALID_EVENT_TYPES.has(body.eventType)) {
    return NextResponse.json({ ok: false, error: "eventType must be 'insert' or 'removal'" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("eventType", sql.VarChar, body.eventType)
    .input("deviceName", sql.NVarChar, body.deviceName ?? null)
    .input("vendorId", sql.VarChar, body.vendorId || null)
    .input("vendorName", sql.NVarChar, body.vendorName || null)
    .input("serialNumber", sql.NVarChar, body.serialNumber || null)
    .input("storageCapacityGB", sql.Float, body.storageCapacityGB ?? null)
    .query(`
      INSERT INTO DeviceUsbEvents (DeviceId, EventType, DeviceName, VendorId, VendorName, SerialNumber, StorageCapacityGB)
      VALUES (@deviceId, @eventType, @deviceName, @vendorId, @vendorName, @serialNumber, @storageCapacityGB)
    `);

  return NextResponse.json({ ok: true });
}

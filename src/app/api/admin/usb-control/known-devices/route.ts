import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Feeds the "choose from history/connected devices" picker on the Block/Allow pages - one row
// per distinct device identity ever seen (across all endpoints), deduplicated the same way
// Connected USB derives "currently connected" (latest event per identity), so an admin can pick
// an exact device instead of hand-typing its vendor/product/serial IDs.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query(`
    WITH Ranked AS (
      SELECT *,
        ROW_NUMBER() OVER (
          PARTITION BY DeviceId, ISNULL(VendorId, ''), ISNULL(ProductId, ''), ISNULL(SerialNumber, ''), ISNULL(DeviceName, '')
          ORDER BY DetectedAt DESC
        ) AS rn
      FROM DeviceUsbEvents
    )
    SELECT d.DeviceName AS HostName, d.Hostname, r.DeviceName AS UsbName, r.VendorId, r.ProductId, r.VendorName,
      r.SerialNumber, r.StorageCapacityGB, CONVERT(VARCHAR(19), r.DetectedAt, 126) AS LastSeenAt,
      CASE WHEN r.EventType = 'insert' THEN 1 ELSE 0 END AS IsConnected
    FROM Ranked r
    JOIN Devices d ON d.DeviceId = r.DeviceId
    WHERE r.rn = 1
    ORDER BY IsConnected DESC, r.DetectedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

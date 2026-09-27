import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";

// Staff roster for the "assign staff to a group" view - reuses the existing Staff table
// (Name/Department/MacAddress/AdSamAccountName) rather than a parallel staff list, per the
// spec's explicit instruction not to duplicate Staff.
export async function GET() {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const db = await getDb();
  // DeviceId/WebsiteBlockingEnabled added so the Rules UI can warn (and offer a one-click
  // fix) when an admin creates a Staff-scoped Block rule for someone whose device doesn't
  // actually have local enforcement turned on yet - see /api/admin/devices/[deviceId]/settings.
  // Without this, a Staff rule saves successfully but silently blocks nothing, since
  // /api/agent/heartbeat only ever resolves wacBlockedDomains when
  // Devices.WebsiteBlockingEnabled is true for that device.
  const result = await db.query(`
    SELECT s.Id, s.Name, s.Department, s.AdSamAccountName, s.MacAddress, s.WacGroupId, g.Name AS WacGroupName,
      d.DeviceId, d.WebsiteBlockingEnabled
    FROM Staff s
    LEFT JOIN WacGroups g ON g.Id = s.WacGroupId
    LEFT JOIN Devices d ON d.StaffId = s.Id
    ORDER BY s.Name ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

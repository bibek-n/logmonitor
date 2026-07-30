import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { isDeviceOnline } from "@/lib/remoteSupport/presence";

interface DeviceListRow {
  DeviceId: string;
  Hostname: string;
  Department: string | null;
  StaffId: number | null;
  StaffName: string | null;
  LastHeartbeat: string | null;
  ActiveSessionStatus: string | null;
  ActiveSessionId: number | null;
}

export async function GET(req: NextRequest) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const department = (searchParams.get("department") ?? "").trim();

  const db = await getDb();
  const request = db.request();
  const conditions: string[] = [];

  if (q) {
    request.input("q", sql.NVarChar, `%${q}%`);
    conditions.push("(d.Hostname LIKE @q OR d.DeviceId LIKE @q OR s.Name LIKE @q OR d.Department LIKE @q)");
  }
  if (department) {
    request.input("department", sql.NVarChar, department);
    conditions.push("d.Department = @department");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await request.query<DeviceListRow>(`
    SELECT d.DeviceId, d.Hostname, d.Department, d.StaffId, s.Name AS StaffName, d.LastHeartbeat,
      (SELECT TOP 1 Status FROM RemoteSupportSessions rss
        WHERE rss.DeviceId = d.DeviceId AND rss.Status IN ('Pending','Approved','Active')
        ORDER BY rss.Id DESC) AS ActiveSessionStatus,
      (SELECT TOP 1 Id FROM RemoteSupportSessions rss
        WHERE rss.DeviceId = d.DeviceId AND rss.Status IN ('Pending','Approved','Active')
        ORDER BY rss.Id DESC) AS ActiveSessionId
    FROM Devices d
    LEFT JOIN Staff s ON s.Id = d.StaffId
    ${whereClause}
    ORDER BY d.Hostname ASC
  `);

  const devices = result.recordset.map((row) => {
    const online = isDeviceOnline(row.LastHeartbeat);
    const status = !online ? "Offline" : row.ActiveSessionStatus ? "InSession" : "Online";
    return {
      deviceId: row.DeviceId,
      hostname: row.Hostname,
      department: row.Department,
      staffId: row.StaffId,
      staffName: row.StaffName,
      status,
      activeSessionId: row.ActiveSessionId,
    };
  });

  return NextResponse.json({ ok: true, devices });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

interface DeviceRow {
  DeviceId: string;
  Hostname: string;
  LastIp: string | null;
  MacAddress: string | null;
  StaffId: number | null;
  StaffName: string | null;
}

export async function GET(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  try {
    const db = await getDb();
    const result = await db.query<DeviceRow>(`
      SELECT d.DeviceId, d.Hostname, d.LastIp, d.MacAddress, d.StaffId, s.Name AS StaffName
      FROM Devices d
      LEFT JOIN Staff s ON s.Id = d.StaffId
      ORDER BY d.Hostname
    `);
    return NextResponse.json({ ok: true, devices: result.recordset });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to load devices" });
  }
}

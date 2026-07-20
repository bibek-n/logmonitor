import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

interface CameraRow {
  Id: number;
  NvrId: number;
  NvrName: string;
  ChannelName: string;
  Status: string;
  LastSeenAt: string | null;
  HasSnapshot: boolean;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<CameraRow>(`
    SELECT c.Id, c.NvrId, n.Name AS NvrName, c.ChannelName, c.Status, c.LastSeenAt,
      CAST(CASE WHEN c.SnapshotUri IS NOT NULL THEN 1 ELSE 0 END AS BIT) AS HasSnapshot
    FROM NvrCameras c
    JOIN NvrDevices n ON n.Id = c.NvrId
    ORDER BY n.Name, c.ChannelName
  `);
  return NextResponse.json({ ok: true, cameras: result.recordset });
}

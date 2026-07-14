import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

interface CameraRow {
  Id: number;
  NvrId: number;
  NvrName: string;
  ChannelName: string;
  Status: string;
  Label: string | null;
  Location: string | null;
}

export async function GET(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  try {
    const db = await getDb();
    const result = await db.query<CameraRow>(`
      SELECT c.Id, c.NvrId, n.Name AS NvrName, c.ChannelName, c.Status, c.Label, c.Location
      FROM NvrCameras c
      JOIN NvrDevices n ON n.Id = c.NvrId
      ORDER BY c.SortOrder, n.Name, c.ChannelName
    `);
    return NextResponse.json({ ok: true, cameras: result.recordset });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to load cameras" });
  }
}

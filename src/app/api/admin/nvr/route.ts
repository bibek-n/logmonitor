import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { syncNvrCameras } from "@/lib/nvr";

interface NvrListRow {
  Id: number;
  Name: string;
  IpAddress: string;
  Port: number;
  Status: string;
  LastSyncedAt: string | null;
  LastError: string | null;
  CameraCount: number;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<NvrListRow>(`
    SELECT n.Id, n.Name, n.IpAddress, n.Port, n.Status, n.LastSyncedAt, n.LastError,
      (SELECT COUNT(*) FROM NvrCameras c WHERE c.NvrId = n.Id) AS CameraCount
    FROM NvrDevices n
    ORDER BY n.Name
  `);
  return NextResponse.json({ ok: true, devices: result.recordset });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const ipAddress = typeof body?.ipAddress === "string" ? body.ipAddress.trim() : "";
  const port = Number.isInteger(body?.port) ? body.port : 80;
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const onvifPath = typeof body?.onvifPath === "string" && body.onvifPath ? body.onvifPath.trim() : "/onvif/device_service";

  if (!name || !ipAddress || !username || !password) {
    return NextResponse.json({ ok: false, error: "Name, IP address, username, and password are required." });
  }

  const db = await getDb();
  const insertResult = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("ipAddress", sql.NVarChar, ipAddress)
    .input("port", sql.Int, port)
    .input("username", sql.NVarChar, username)
    .input("password", sql.NVarChar, password)
    .input("onvifPath", sql.NVarChar, onvifPath)
    .query<{ Id: number }>(`
      INSERT INTO NvrDevices (Name, IpAddress, Port, Username, Password, OnvifPath)
      OUTPUT INSERTED.Id
      VALUES (@name, @ipAddress, @port, @username, @password, @onvifPath)
    `);
  const nvrId = insertResult.recordset[0].Id;

  const syncResult = await syncNvrCameras(nvrId);

  return NextResponse.json({ ok: true, nvrId, sync: syncResult });
}

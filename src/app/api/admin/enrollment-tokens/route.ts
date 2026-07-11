import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { generateEnrollmentToken } from "@/lib/agentAuth";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const TOKEN_TTL_HOURS = 24;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => ({}));
  const staffId = typeof body?.staffId === "number" ? body.staffId : null;
  const preCreatedDeviceId = typeof body?.preCreatedDeviceId === "string" ? body.preCreatedDeviceId : null;

  const db = await getDb();

  if (preCreatedDeviceId) {
    const deviceExists = await db
      .request()
      .input("deviceId", sql.VarChar, preCreatedDeviceId)
      .query<{ Id: number }>("SELECT Id FROM Devices WHERE DeviceId = @deviceId");
    if (!deviceExists.recordset[0]) {
      return NextResponse.json({ ok: false, error: "No device found with that id" }, { status: 400 });
    }
  }

  const token = generateEnrollmentToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3600 * 1000);

  const insertResult = await db
    .request()
    .input("token", sql.VarChar, token)
    .input("createdBy", sql.Int, admin.userId)
    .input("expiresAt", sql.DateTime2, expiresAt)
    .input("staffId", sql.Int, staffId)
    .input("preCreatedDeviceId", sql.VarChar, preCreatedDeviceId)
    .query<{ Id: number }>(`
      INSERT INTO EnrollmentTokens (Token, CreatedByUserId, ExpiresAt, StaffId, PreCreatedDeviceId)
      OUTPUT INSERTED.Id
      VALUES (@token, @createdBy, @expiresAt, @staffId, @preCreatedDeviceId)
    `);

  return NextResponse.json({
    ok: true,
    id: insertResult.recordset[0].Id,
    token,
    expiresAt: expiresAt.toISOString(),
    staffId,
    preCreatedDeviceId,
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Token: string;
    CreatedAt: string;
    ExpiresAt: string;
    UsedAt: string | null;
    UsedByDeviceId: string | null;
    StaffId: number | null;
    StaffName: string | null;
    PreCreatedDeviceId: string | null;
  }>(`
    SELECT TOP 50 et.Id, et.Token, et.CreatedAt, et.ExpiresAt, et.UsedAt, et.UsedByDeviceId,
      et.StaffId, s.Name AS StaffName, et.PreCreatedDeviceId
    FROM EnrollmentTokens et
    LEFT JOIN Staff s ON s.Id = et.StaffId
    ORDER BY et.CreatedAt DESC
  `);

  return NextResponse.json({ ok: true, tokens: result.recordset });
}

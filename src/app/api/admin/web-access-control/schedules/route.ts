import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { createScheduleSchema } from "@/lib/webAccessControl/schema";

export async function GET() {
  const wac = await requireWebAccessControlPermission("wac_view");
  if (!isWebAccessControlSession(wac)) return wac;

  const db = await getDb();
  const result = await db.query(`
    SELECT Id, Name, DaysOfWeek, CONVERT(VARCHAR(8), StartTime, 108) AS StartTime, CONVERT(VARCHAR(8), EndTime, 108) AS EndTime, IsBuiltIn
    FROM WacSchedules
    ORDER BY IsBuiltIn DESC, Name ASC
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest) {
  const wac = await requireWebAccessControlPermission("wac_schedule_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const body = await req.json().catch(() => null);
  const parsed = createScheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule payload" }, { status: 400 });
  const s = parsed.data;

  if ((s.startTime && !s.endTime) || (!s.startTime && s.endTime)) {
    return NextResponse.json({ ok: false, error: "startTime and endTime must be set together" }, { status: 400 });
  }

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, s.name)
    .input("daysOfWeek", sql.VarChar, s.daysOfWeek?.join(",") ?? null)
    .input("startTime", sql.VarChar, s.startTime ?? null)
    .input("endTime", sql.VarChar, s.endTime ?? null)
    .query<{ Id: number }>(`
      INSERT INTO WacSchedules (Name, DaysOfWeek, StartTime, EndTime, IsBuiltIn) OUTPUT INSERTED.Id
      VALUES (@name, @daysOfWeek, @startTime, @endTime, 0)
    `);

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "schedule_create",
    req,
    details: JSON.stringify({ new: s }),
  });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}

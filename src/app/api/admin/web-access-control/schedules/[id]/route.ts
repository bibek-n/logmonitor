import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isWebAccessControlSession, requireWebAccessControlPermission } from "@/lib/requireWebAccessControlPermission";
import { updateScheduleSchema } from "@/lib/webAccessControl/schema";

interface ScheduleRow {
  Id: number;
  Name: string;
  DaysOfWeek: string | null;
  StartTime: string | null;
  EndTime: string | null;
  IsBuiltIn: boolean;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_schedule_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const scheduleId = Number(id);
  const body = await req.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid schedule payload" }, { status: 400 });
  const s = parsed.data;

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, scheduleId)
    .query<ScheduleRow>("SELECT Id, Name, DaysOfWeek, CONVERT(VARCHAR(8), StartTime, 108) AS StartTime, CONVERT(VARCHAR(8), EndTime, 108) AS EndTime, IsBuiltIn FROM WacSchedules WHERE Id = @id");
  const before = existing.recordset[0];
  if (!before) return NextResponse.json({ ok: false, error: "Schedule not found" }, { status: 404 });

  const next = {
    name: s.name ?? before.Name,
    daysOfWeek: s.daysOfWeek !== undefined ? s.daysOfWeek?.join(",") ?? null : before.DaysOfWeek,
    startTime: s.startTime !== undefined ? s.startTime : before.StartTime?.slice(0, 5) ?? null,
    endTime: s.endTime !== undefined ? s.endTime : before.EndTime?.slice(0, 5) ?? null,
  };
  if ((next.startTime && !next.endTime) || (!next.startTime && next.endTime)) {
    return NextResponse.json({ ok: false, error: "startTime and endTime must be set together" }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, scheduleId)
    .input("name", sql.NVarChar, next.name)
    .input("daysOfWeek", sql.VarChar, next.daysOfWeek)
    .input("startTime", sql.VarChar, next.startTime)
    .input("endTime", sql.VarChar, next.endTime)
    .query("UPDATE WacSchedules SET Name = @name, DaysOfWeek = @daysOfWeek, StartTime = @startTime, EndTime = @endTime WHERE Id = @id");

  await logAdminAction({
    admin: wac,
    section: "web-access-control",
    action: "schedule_update",
    req,
    details: JSON.stringify({ old: before, new: next }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const wac = await requireWebAccessControlPermission("wac_schedule_manage");
  if (!isWebAccessControlSession(wac)) return wac;

  const { id } = await params;
  const scheduleId = Number(id);
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, scheduleId).query<ScheduleRow>("SELECT Id, Name, IsBuiltIn FROM WacSchedules WHERE Id = @id");
  const schedule = existing.recordset[0];
  if (!schedule) return NextResponse.json({ ok: false, error: "Schedule not found" }, { status: 404 });
  if (schedule.IsBuiltIn) {
    return NextResponse.json({ ok: false, error: "Built-in schedules cannot be deleted" }, { status: 400 });
  }

  const usageCheck = await db.request().input("id", sql.Int, scheduleId).query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM WacWebsiteRules WHERE ScheduleId = @id");
  if (usageCheck.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "Reassign rules using this schedule before deleting it" }, { status: 400 });
  }

  await db.request().input("id", sql.Int, scheduleId).query("DELETE FROM WacSchedules WHERE Id = @id");

  await logAdminAction({ admin: wac, section: "web-access-control", action: "schedule_delete", req, details: JSON.stringify({ old: { name: schedule.Name } }) });

  return NextResponse.json({ ok: true });
}

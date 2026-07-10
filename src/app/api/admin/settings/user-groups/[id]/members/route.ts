import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const groupId = Number(id);
  if (!Number.isInteger(groupId)) return NextResponse.json({ ok: false, error: "Invalid id" }, { status: 400 });

  const db = await getDb();
  const result = await db.request().input("groupId", sql.Int, groupId).query(`
    SELECT u.Id, u.Username FROM UserGroupMembers m JOIN Users u ON u.Id = m.UserId WHERE m.GroupId = @groupId ORDER BY u.Username
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const groupId = Number(id);
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  if (!Number.isInteger(groupId) || !Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("groupId", sql.Int, groupId)
    .input("userId", sql.Int, userId)
    .query("SELECT 1 FROM UserGroupMembers WHERE GroupId = @groupId AND UserId = @userId");
  if (existing.recordset.length === 0) {
    await db
      .request()
      .input("groupId", sql.Int, groupId)
      .input("userId", sql.Int, userId)
      .query("INSERT INTO UserGroupMembers (GroupId, UserId) VALUES (@groupId, @userId)");
  }

  await logAdminAction({ admin, section: "users_access", action: "add_group_member", details: `groupId=${groupId} userId=${userId}`, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const groupId = Number(id);
  const userId = Number(new URL(req.url).searchParams.get("userId"));
  if (!Number.isInteger(groupId) || !Number.isInteger(userId)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("groupId", sql.Int, groupId)
    .input("userId", sql.Int, userId)
    .query("DELETE FROM UserGroupMembers WHERE GroupId = @groupId AND UserId = @userId");

  await logAdminAction({ admin, section: "users_access", action: "remove_group_member", details: `groupId=${groupId} userId=${userId}`, req });

  return NextResponse.json({ ok: true });
}

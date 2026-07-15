import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Logical failures always respond 200 (via `ok: false`) rather than a real 4xx/5xx status —
// confirmed live this session that this app's IIS front end replaces non-2xx response
// bodies with a generic HTML error page, which would otherwise hand the dashboard's
// `res.json()` an HTML document instead of the intended error payload.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { staffId: staffIdParam } = await params;
  const staffId = Number(staffIdParam);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid staff id" });
  }

  const db = await getDb();

  const staffResult = await db.request().input("id", sql.Int, staffId).query<{ Id: number; Name: string }>(
    "SELECT Id, Name FROM Staff WHERE Id = @id"
  );
  const staff = staffResult.recordset[0];
  if (!staff) return NextResponse.json({ ok: false, error: "Staff not found" });

  const messagesResult = await db
    .request()
    .input("staffId", sql.Int, staffId)
    .query<{ Id: number; SenderType: string; SenderName: string; Message: string; CreatedAt: string }>(
      "SELECT Id, SenderType, SenderName, Message, CreatedAt FROM ChatMessages WHERE StaffId = @staffId ORDER BY CreatedAt ASC, Id ASC"
    );

  await db
    .request()
    .input("staffId", sql.Int, staffId)
    .query("UPDATE ChatMessages SET ReadByAdminAt = SYSUTCDATETIME() WHERE StaffId = @staffId AND SenderType = 'employee' AND ReadByAdminAt IS NULL");

  return NextResponse.json({ ok: true, staff, messages: messagesResult.recordset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { staffId: staffIdParam } = await params;
  const staffId = Number(staffIdParam);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid staff id" });
  }

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ ok: false, error: "Message is required" });
  if (message.length > 4000) return NextResponse.json({ ok: false, error: "Message is too long" });

  const db = await getDb();
  const staffResult = await db.request().input("id", sql.Int, staffId).query<{ Id: number }>("SELECT Id FROM Staff WHERE Id = @id");
  if (!staffResult.recordset[0]) return NextResponse.json({ ok: false, error: "Staff not found" });

  await db
    .request()
    .input("staffId", sql.Int, staffId)
    .input("senderName", sql.NVarChar, admin.username)
    .input("message", sql.NVarChar, message)
    .query(
      "INSERT INTO ChatMessages (StaffId, SenderType, SenderName, Message, ReadByAdminAt) VALUES (@staffId, 'admin', @senderName, @message, SYSUTCDATETIME())"
    );

  return NextResponse.json({ ok: true });
}

// Clears the whole conversation with this employee - a hard delete, not a soft/archive
// flag, since there's no UI anywhere to view "deleted" chat history and a half-implemented
// undo would be worse than none. The confirmation prompt lives client-side; this endpoint
// trusts the admin session the same way every other destructive admin action in this app does.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { staffId: staffIdParam } = await params;
  const staffId = Number(staffIdParam);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid staff id" });
  }

  const db = await getDb();
  const staffResult = await db.request().input("id", sql.Int, staffId).query<{ Id: number; Name: string }>(
    "SELECT Id, Name FROM Staff WHERE Id = @id"
  );
  const staff = staffResult.recordset[0];
  if (!staff) return NextResponse.json({ ok: false, error: "Staff not found" });

  await db.request().input("staffId", sql.Int, staffId).query("DELETE FROM ChatMessages WHERE StaffId = @staffId");

  await logAdminAction({ admin, section: "chat", action: "delete_conversation", details: staff.Name, req });

  return NextResponse.json({ ok: true });
}

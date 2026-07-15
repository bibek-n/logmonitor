import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Deletes one row from send history - this only removes it from the admin's "Recently
// Sent" list, it does not retract an already-delivered popup (the employee's chat
// companion has already shown it by the time an admin would think to delete it here).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid notification id" });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Id: number; Message: string }>(
    "SELECT Id, Message FROM EmployeeNotifications WHERE Id = @id"
  );
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Notification not found" });

  await db.request().input("id", sql.Int, id).query("DELETE FROM EmployeeNotifications WHERE Id = @id");

  await logAdminAction({
    admin,
    section: "notifications",
    action: "delete_notification",
    details: existing.recordset[0].Message.slice(0, 120),
    req,
  });

  return NextResponse.json({ ok: true });
}

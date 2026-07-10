import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { sendNotificationEmail } from "@/lib/notifyEmail";

const VALID_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const ticketId = Number(id);
  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!Number.isInteger(ticketId) || !VALID_STATUSES.has(status)) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const db = await getDb();
  const ticketResult = await db.request().input("id", sql.Int, ticketId).query<{ TicketNumber: string; Email: string; Name: string }>(
    "SELECT TicketNumber, Email, Name FROM SupportTickets WHERE Id = @id"
  );
  const ticket = ticketResult.recordset[0];
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "Ticket not found" }, { status: 404 });
  }

  await db
    .request()
    .input("id", sql.Int, ticketId)
    .input("status", sql.VarChar, status)
    .query("UPDATE SupportTickets SET Status = @status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await sendNotificationEmail({
    to: ticket.Email,
    subject: `Ticket ${ticket.TicketNumber} status updated`,
    body: `Hi ${ticket.Name},\n\nYour ticket ${ticket.TicketNumber} status is now: ${status.replace("_", " ")}.`,
  });

  return NextResponse.json({ ok: true });
}

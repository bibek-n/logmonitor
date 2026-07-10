import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { sendNotificationEmail } from "@/lib/notifyEmail";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const ticketId = Number(id);
  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const isInternal = body?.isInternal === true;

  if (!Number.isInteger(ticketId) || !message) {
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
    .input("ticketId", sql.Int, ticketId)
    .input("authorUserId", sql.Int, admin.userId)
    .input("message", sql.NVarChar, message)
    .input("isInternal", sql.Bit, isInternal)
    .query("INSERT INTO SupportTicketNotes (TicketId, AuthorUserId, Message, IsInternal) VALUES (@ticketId, @authorUserId, @message, @isInternal)");

  if (!isInternal) {
    await sendNotificationEmail({
      to: ticket.Email,
      subject: `New reply on ticket ${ticket.TicketNumber}`,
      body: `Hi ${ticket.Name},\n\nYou have a new reply on ticket ${ticket.TicketNumber}:\n\n${message}`,
    });
  }

  return NextResponse.json({ ok: true });
}

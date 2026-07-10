import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";

// Unauthenticated public lookup — deliberately exposes only status/subject/category/
// priority/non-internal replies, never the full ticket row, and requires the exact
// ticket number + email combination (not guessable from the ticket number alone).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ticketNumber = typeof body?.ticketNumber === "string" ? body.ticketNumber.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!ticketNumber || !email) {
    return NextResponse.json({ ok: false, error: "Ticket number and email are required." }, { status: 400 });
  }

  const db = await getDb();
  const ticketResult = await db
    .request()
    .input("ticketNumber", sql.VarChar, ticketNumber)
    .input("email", sql.NVarChar, email)
    .query<{ Id: number; TicketNumber: string; Subject: string; Category: string; Priority: string; Status: string; CreatedAt: string }>(`
      SELECT Id, TicketNumber, Subject, Category, Priority, Status, CreatedAt
      FROM SupportTickets
      WHERE TicketNumber = @ticketNumber AND UPPER(Email) = UPPER(@email)
    `);

  const ticket = ticketResult.recordset[0];
  if (!ticket) {
    return NextResponse.json({ ok: false, error: "No ticket found matching that ticket number and email." }, { status: 404 });
  }

  const notesResult = await db
    .request()
    .input("ticketId", sql.Int, ticket.Id)
    .query<{ Message: string; CreatedAt: string }>(`
      SELECT Message, CreatedAt FROM SupportTicketNotes
      WHERE TicketId = @ticketId AND IsInternal = 0
      ORDER BY CreatedAt ASC
    `);

  return NextResponse.json({
    ok: true,
    ticket: {
      ticketNumber: ticket.TicketNumber,
      subject: ticket.Subject,
      category: ticket.Category,
      priority: ticket.Priority,
      status: ticket.Status,
      createdAt: ticket.CreatedAt,
      replies: notesResult.recordset.map((n) => ({ message: n.Message, createdAt: n.CreatedAt })),
    },
  });
}

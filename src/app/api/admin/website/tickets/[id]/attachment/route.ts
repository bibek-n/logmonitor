import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { readTicketAttachment } from "@/lib/ticketAttachments";

// The only way a ticket attachment (submitted via an unauthenticated public form) is
// ever reachable — admin-gated, never served from a public path.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) {
    return NextResponse.json({ ok: false, error: "Invalid ticket id" }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, ticketId)
    .query<{ AttachmentPath: string | null; AttachmentOriginalName: string | null }>(
      "SELECT AttachmentPath, AttachmentOriginalName FROM SupportTickets WHERE Id = @id"
    );
  const ticket = result.recordset[0];
  if (!ticket || !ticket.AttachmentPath) {
    return NextResponse.json({ ok: false, error: "No attachment for this ticket" }, { status: 404 });
  }

  const bytes = await readTicketAttachment(ticket.AttachmentPath);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${ticket.AttachmentOriginalName ?? "attachment"}"`,
    },
  });
}

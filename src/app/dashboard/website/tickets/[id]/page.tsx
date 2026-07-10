import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { TicketDetail, type TicketDetailData, type TicketNote } from "@/components/website/TicketDetail";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Ticket</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view support tickets.</p>
      </div>
    );
  }

  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const db = await getDb();
  const ticketResult = await db
    .request()
    .input("id", sql.Int, ticketId)
    .query<TicketDetailData>(`
      SELECT Id, TicketNumber, Name, Email, Subject, Category, Priority, Status, Description,
        AttachmentPath, AttachmentOriginalName,
        CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
      FROM SupportTickets
      WHERE Id = @id
    `);
  const ticket = ticketResult.recordset[0];
  if (!ticket) notFound();

  const notesResult = await db.request().input("ticketId", sql.Int, ticketId).query<TicketNote>(`
    SELECT n.Id, n.Message, n.IsInternal, CONVERT(VARCHAR(19), n.CreatedAt, 126) AS CreatedAt,
      u.Username AS AuthorUsername
    FROM SupportTicketNotes n
    LEFT JOIN Users u ON u.Id = n.AuthorUserId
    WHERE n.TicketId = @ticketId
    ORDER BY n.CreatedAt ASC
  `);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Ticket {ticket.TicketNumber}</h1>
      <TicketDetail ticket={ticket} notes={notesResult.recordset} />
    </div>
  );
}

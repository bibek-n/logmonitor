import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { validateAttachment, saveTicketAttachment } from "@/lib/ticketAttachments";
import { sendNotificationEmail } from "@/lib/notifyEmail";
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from "@/lib/websiteContent";

// Unauthenticated public endpoint — the support ticket submission form has no login.
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ ok: false, error: "Invalid form submission" }, { status: 400 });
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  const priority = String(formData.get("priority") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const attachment = formData.get("attachment");

  if (!name || !email || !subject || !description) {
    return NextResponse.json({ ok: false, error: "Name, email, subject, and description are required." }, { status: 400 });
  }
  if (!TICKET_CATEGORIES.includes(category) || !TICKET_PRIORITIES.includes(priority)) {
    return NextResponse.json({ ok: false, error: "Invalid category or priority." }, { status: 400 });
  }

  let attachmentPath: string | null = null;
  let attachmentOriginalName: string | null = null;

  if (attachment instanceof File && attachment.size > 0) {
    const validation = validateAttachment(attachment.name, attachment.size);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
    const buffer = Buffer.from(await attachment.arrayBuffer());
    attachmentPath = await saveTicketAttachment(buffer, attachment.name);
    attachmentOriginalName = attachment.name;
  }

  const db = await getDb();

  const insertResult = await db
    .request()
    .input("name", sql.NVarChar, name)
    .input("email", sql.NVarChar, email)
    .input("subject", sql.NVarChar, subject)
    .input("category", sql.NVarChar, category)
    .input("priority", sql.VarChar, priority)
    .input("description", sql.NVarChar, description)
    .input("attachmentPath", sql.NVarChar, attachmentPath)
    .input("attachmentOriginalName", sql.NVarChar, attachmentOriginalName)
    .query<{ Id: number }>(`
      INSERT INTO SupportTickets
        (TicketNumber, Name, Email, Subject, Category, Priority, Description, AttachmentPath, AttachmentOriginalName, Status)
      OUTPUT INSERTED.Id
      VALUES
        ('PENDING-' + CAST(NEWID() AS VARCHAR(36)), @name, @email, @subject, @category, @priority, @description,
         @attachmentPath, @attachmentOriginalName, 'open')
    `);

  const id = insertResult.recordset[0].Id;
  const ticketNumber = `TCK-${String(id).padStart(6, "0")}`;

  await db
    .request()
    .input("id", sql.Int, id)
    .input("ticketNumber", sql.VarChar, ticketNumber)
    .query("UPDATE SupportTickets SET TicketNumber = @ticketNumber WHERE Id = @id");

  await sendNotificationEmail({
    to: email,
    subject: `Support ticket received: ${ticketNumber}`,
    body: `Hi ${name},\n\nWe've received your support ticket "${subject}" (${ticketNumber}). Our team will follow up soon.\n\nYou can check its status anytime at the Support Tickets page using this ticket number and your email.`,
  });

  return NextResponse.json({ ok: true, ticketNumber });
}

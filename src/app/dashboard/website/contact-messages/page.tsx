import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { ContactMessagesAdmin, type ContactMessageRow } from "@/components/website/ContactMessagesAdmin";

export const dynamic = "force-dynamic";

export default async function ContactMessagesAdminPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Contact Messages</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view contact messages.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<ContactMessageRow>(`
    SELECT Id, Name, Email, Phone, Subject, Message,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt,
      CONVERT(VARCHAR(19), ReadAt, 126) AS ReadAt
    FROM ContactMessages
    ORDER BY CreatedAt DESC
  `);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Contact Messages</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Submissions from the public Contact Us form.
      </p>
      <ContactMessagesAdmin messages={result.recordset} />
    </div>
  );
}

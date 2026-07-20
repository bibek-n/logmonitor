import { getDb } from "@/lib/db";
import ChatClient, { type StaffChatSummary } from "@/components/chat/ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const db = await getDb();
  const result = await db.query<StaffChatSummary>(`
    SELECT s.Id, s.Name,
           latest.Message AS LastMessage, latest.SenderType AS LastSenderType, latest.CreatedAt AS LastMessageAt,
           COALESCE(unread.Cnt, 0) AS UnreadCount
    FROM Staff s
    OUTER APPLY (
      SELECT TOP 1 Message, SenderType, CreatedAt FROM ChatMessages WHERE StaffId = s.Id ORDER BY CreatedAt DESC, Id DESC
    ) latest
    OUTER APPLY (
      SELECT COUNT(*) AS Cnt FROM ChatMessages WHERE StaffId = s.Id AND SenderType = 'employee' AND ReadByAdminAt IS NULL
    ) unread
    WHERE latest.Message IS NOT NULL OR unread.Cnt > 0
    ORDER BY latest.CreatedAt DESC
  `);

  const allStaffResult = await db.query<{ Id: number; Name: string }>("SELECT Id, Name FROM Staff ORDER BY Name");

  return (
    <div>
      <h1>Employee Chat</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Message an employee directly — they receive it via a small chat companion installed alongside their monitoring
        agent (a tray icon notification that opens their chat). Only employees who have exchanged at least one message
        appear in the list below; use the picker to start a new conversation with anyone else.
      </p>
      <ChatClient initialStaff={result.recordset} allStaff={allStaffResult.recordset} />
    </div>
  );
}

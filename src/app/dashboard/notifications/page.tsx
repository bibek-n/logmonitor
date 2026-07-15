import { getDb } from "@/lib/db";
import { NotificationsClient, type NotificationHistoryRow, type StaffOption } from "@/components/notifications/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const db = await getDb();

  const [staffResult, historyResult] = await Promise.all([
    db.query<StaffOption>("SELECT Id, Name FROM Staff ORDER BY Name"),
    db.query<NotificationHistoryRow>(`
      SELECT TOP 100 n.Id, n.StaffId, s.Name AS StaffName, n.Message, n.SentByUsername, CONVERT(VARCHAR(19), n.CreatedAt, 126) AS CreatedAt
      FROM EmployeeNotifications n
      LEFT JOIN Staff s ON s.Id = n.StaffId
      ORDER BY n.Id DESC
    `),
  ]);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Send Notification</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Send a message to one employee or everyone at once — it pops up on their screen (above the system clock) via
        the chat companion installed alongside their monitoring agent.
      </p>
      <NotificationsClient staffOptions={staffResult.recordset} initialHistory={historyResult.recordset} />
    </div>
  );
}

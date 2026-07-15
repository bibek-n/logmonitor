import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

// Polled client-side (Sidebar for the red nav badge, HeaderClient for the new-message toast)
// so an incoming employee chat message surfaces immediately without the admin having to be
// on the chat page. Mirrors /api/admin/alerts/recent's polling shape.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{ Id: number; StaffId: number; StaffName: string; Message: string; CreatedAt: string }>(`
    SELECT TOP 20 cm.Id, cm.StaffId, s.Name AS StaffName, cm.Message, cm.CreatedAt
    FROM ChatMessages cm
    JOIN Staff s ON s.Id = cm.StaffId
    WHERE cm.SenderType = 'employee' AND cm.ReadByAdminAt IS NULL
    ORDER BY cm.CreatedAt DESC
  `);
  const countResult = await db.query<{ Cnt: number }>(
    "SELECT COUNT(*) AS Cnt FROM ChatMessages WHERE SenderType = 'employee' AND ReadByAdminAt IS NULL"
  );

  return NextResponse.json({ ok: true, count: countResult.recordset[0]?.Cnt ?? 0, messages: result.recordset });
}

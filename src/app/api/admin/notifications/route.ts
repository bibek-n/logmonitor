import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

interface NotificationRow {
  Id: number;
  StaffId: number | null;
  StaffName: string | null;
  Message: string;
  SentByUsername: string;
  CreatedAt: string;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<NotificationRow>(`
    SELECT TOP 100 n.Id, n.StaffId, s.Name AS StaffName, n.Message, n.SentByUsername, n.CreatedAt
    FROM EmployeeNotifications n
    LEFT JOIN Staff s ON s.Id = n.StaffId
    ORDER BY n.Id DESC
  `);
  return NextResponse.json({ ok: true, notifications: result.recordset });
}

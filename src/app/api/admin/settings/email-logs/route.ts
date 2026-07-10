import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query`
    SELECT TOP 200 Id, ToAddress, Subject, Success, ErrorMessage,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM EmailDeliveryLog
    ORDER BY CreatedAt DESC
  `;
  return NextResponse.json({ ok: true, data: result.recordset });
}

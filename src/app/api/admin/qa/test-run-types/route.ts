import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireQaPermission, isQaSession } from "@/lib/requireQaPermission";
import { type QaTestRunTypeRow } from "@/lib/qaShared";

export async function GET(_req: NextRequest) {
  const qa = await requireQaPermission("qa_view");
  if (!isQaSession(qa)) return qa;

  const db = await getDb();
  const result = await db.query<QaTestRunTypeRow>`
    SELECT Id, Name, Description, IsActive FROM QaTestRunTypes WHERE IsActive = 1 ORDER BY Id ASC
  `;

  return NextResponse.json({ ok: true, data: result.recordset });
}

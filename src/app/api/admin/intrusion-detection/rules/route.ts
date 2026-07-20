import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";

export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query(`
    SELECT Id, RuleKey, Name, Description, Category, Severity, Confidence, DataSource, Enabled, ThresholdCount, ThresholdWindowSeconds, CooldownSeconds, Tags, RecommendedAction, Version,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt, CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM SecurityDetectionRules
    ORDER BY Category, Name
  `);

  return NextResponse.json({ ok: true, data: result.recordset });
}

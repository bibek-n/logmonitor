import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";

// Rule tuning (enable/disable, threshold/window/cooldown) is a security_admin action - a
// misconfigured rule can silence real attacks or flood the dashboard with noise, so this
// sits above the analyst tier that handles day-to-day alert triage.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const ruleId = Number(id);
  if (!Number.isInteger(ruleId) || ruleId <= 0) return NextResponse.json({ ok: false, error: "Invalid rule id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, ruleId).query<{ Name: string; Enabled: boolean }>(`SELECT Name, Enabled FROM SecurityDetectionRules WHERE Id = @id`);
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Rule not found." }, { status: 404 });

  const enabled = typeof body?.enabled === "boolean" ? body.enabled : existing.recordset[0].Enabled;
  const thresholdCount = Number.isInteger(body?.thresholdCount) ? body.thresholdCount : undefined;
  const thresholdWindowSeconds = Number.isInteger(body?.thresholdWindowSeconds) ? body.thresholdWindowSeconds : undefined;
  const cooldownSeconds = Number.isInteger(body?.cooldownSeconds) ? body.cooldownSeconds : undefined;

  if (thresholdCount !== undefined && thresholdCount < 1) return NextResponse.json({ ok: false, error: "thresholdCount must be at least 1." }, { status: 400 });
  if (thresholdWindowSeconds !== undefined && thresholdWindowSeconds < 1) return NextResponse.json({ ok: false, error: "thresholdWindowSeconds must be at least 1." }, { status: 400 });
  if (cooldownSeconds !== undefined && cooldownSeconds < 0) return NextResponse.json({ ok: false, error: "cooldownSeconds cannot be negative." }, { status: 400 });

  const request = db.request().input("id", sql.Int, ruleId).input("enabled", sql.Bit, enabled);
  let setClause = "Enabled = @enabled, UpdatedAt = SYSUTCDATETIME()";
  if (thresholdCount !== undefined) {
    request.input("thresholdCount", sql.Int, thresholdCount);
    setClause += ", ThresholdCount = @thresholdCount";
  }
  if (thresholdWindowSeconds !== undefined) {
    request.input("thresholdWindowSeconds", sql.Int, thresholdWindowSeconds);
    setClause += ", ThresholdWindowSeconds = @thresholdWindowSeconds";
  }
  if (cooldownSeconds !== undefined) {
    request.input("cooldownSeconds", sql.Int, cooldownSeconds);
    setClause += ", CooldownSeconds = @cooldownSeconds";
  }

  await request.query(`UPDATE SecurityDetectionRules SET ${setClause} WHERE Id = @id`);

  await logAdminAction({
    admin: session,
    section: "intrusion-detection",
    action: "rule_updated",
    details: `Rule "${existing.recordset[0].Name}" (#${ruleId}): enabled=${enabled}${thresholdCount !== undefined ? `, threshold=${thresholdCount}` : ""}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

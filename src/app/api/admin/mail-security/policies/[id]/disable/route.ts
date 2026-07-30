import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { loadPolicyById } from "@/lib/mailSecurity/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_policy_enable");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policy = await loadPolicyById(Number(id));
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  const db = await getDb();
  await db.request().input("id", sql.Int, policy.id).query("UPDATE MailBlockingPolicies SET Enabled = 0, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: mail, section: "mail-security", action: "policy_disable", details: policy.name, req });

  return NextResponse.json({ ok: true });
}

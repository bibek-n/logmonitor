import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { requireWafPermission, isWafSession } from "@/lib/requireWafPermission";
import { logAdminAction } from "@/lib/adminAudit";

export async function GET() {
  const waf = await requireWafPermission("waf_view");
  if (!isWafSession(waf)) return waf;

  const db = await getDb();
  const result = await db.query(`
    SELECT AttackEventRetentionDays, RequestLogRetentionDays, TrustedProxyIpsJson,
      CONVERT(VARCHAR(19), UpdatedAt, 126) AS UpdatedAt
    FROM WafSettings WHERE Id = 1
  `);

  return NextResponse.json({ ok: true, data: result.recordset[0] });
}

const bodySchema = z.object({
  attackEventRetentionDays: z.number().int().min(1).max(3650).optional(),
  requestLogRetentionDays: z.number().int().min(1).max(3650).optional(),
  trustedProxyIps: z.array(z.string()).optional(),
});

// trustedProxyIps backs spec section 4's "only trust forwarding headers from configured
// trusted proxies" - the reverse-proxy layer (a later phase) reads this list to decide
// whether to honor an incoming X-Forwarded-For/X-Real-IP rather than trusting it blindly.
export async function PATCH(req: NextRequest) {
  const waf = await requireWafPermission("waf_manage_settings");
  if (!isWafSession(waf)) return waf;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid settings payload" }, { status: 400 });
  }
  const b = parsed.data;

  const db = await getDb();
  const request = db.request();
  const setClauses: string[] = [];

  if (b.attackEventRetentionDays !== undefined) { request.input("attackEventRetentionDays", sql.Int, b.attackEventRetentionDays); setClauses.push("AttackEventRetentionDays = @attackEventRetentionDays"); }
  if (b.requestLogRetentionDays !== undefined) { request.input("requestLogRetentionDays", sql.Int, b.requestLogRetentionDays); setClauses.push("RequestLogRetentionDays = @requestLogRetentionDays"); }
  if (b.trustedProxyIps !== undefined) { request.input("trustedProxyIpsJson", sql.NVarChar, JSON.stringify(b.trustedProxyIps)); setClauses.push("TrustedProxyIpsJson = @trustedProxyIpsJson"); }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: false, error: "No fields to update" }, { status: 400 });
  }
  setClauses.push("UpdatedAt = SYSUTCDATETIME()");

  await request.query(`UPDATE WafSettings SET ${setClauses.join(", ")} WHERE Id = 1`);

  await logAdminAction({ admin: waf, section: "waf-gateway", action: "settings_update", details: JSON.stringify(b), req });

  return NextResponse.json({ ok: true });
}

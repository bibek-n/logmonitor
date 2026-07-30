import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { createAlertContactSchema } from "@/lib/websiteApiMonitoring/schema";

export async function GET() {
  const mon = await requireMonitoringPermission("mon_alert_contacts_view");
  if (!isMonitoringSession(mon)) return mon;

  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; ContactType: string; Destination: string; ConfigJson: string | null; VerificationStatus: string; IsActive: boolean; CreatedAt: string }>(
    "SELECT Id, Name, ContactType, Destination, ConfigJson, VerificationStatus, IsActive, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt FROM AlertContacts ORDER BY Name ASC"
  );

  // Never send a signing secret back to the browser - only whether one is configured.
  const data = result.recordset.map((r) => {
    const hasSigningSecret = !!(r.ConfigJson && JSON.parse(r.ConfigJson).signingSecret);
    const { ConfigJson: _configJson, ...rest } = r;
    return { ...rest, hasSigningSecret };
  });

  return NextResponse.json({ ok: true, data });
}

export async function POST(req: NextRequest) {
  const mon = await requireMonitoringPermission("mon_alert_contacts_manage");
  if (!isMonitoringSession(mon)) return mon;

  const body = await req.json().catch(() => null);
  const parsed = createAlertContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alert contact payload" }, { status: 400 });
  }
  const p = parsed.data;
  const configJson = p.contactType === "Webhook" && p.signingSecret ? JSON.stringify({ signingSecret: p.signingSecret }) : null;

  const db = await getDb();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("contactType", sql.VarChar, p.contactType)
    .input("destination", sql.NVarChar, p.destination)
    .input("configJson", sql.NVarChar, configJson)
    .input("isActive", sql.Bit, p.isActive)
    .query<{ Id: number }>(`
      INSERT INTO AlertContacts (Name, ContactType, Destination, ConfigJson, IsActive)
      OUTPUT INSERTED.Id
      VALUES (@name, @contactType, @destination, @configJson, @isActive)
    `);

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_contact_create", details: `${p.name} (${p.destination})`, req });

  return NextResponse.json({ ok: true, data: { id: inserted.recordset[0].Id } });
}

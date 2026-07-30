import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isMonitoringSession, requireMonitoringPermission } from "@/lib/requireMonitoringPermission";
import { updateAlertContactSchema } from "@/lib/websiteApiMonitoring/schema";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_contacts_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateAlertContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid alert contact payload" }, { status: 400 });
  }
  const p = parsed.data;

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, Number(id))
    .query<{ Name: string; ContactType: string; ConfigJson: string | null }>("SELECT Name, ContactType, ConfigJson FROM AlertContacts WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Alert contact not found" }, { status: 404 });

  const contactType = p.contactType ?? existing.recordset[0].ContactType;
  // signingSecret only applies to Webhook contacts, and (matching the API monitor secret
  // convention) an omitted value keeps whatever was already saved rather than clearing it.
  const configJson =
    contactType === "Webhook"
      ? p.signingSecret !== undefined
        ? p.signingSecret
          ? JSON.stringify({ signingSecret: p.signingSecret })
          : null
        : existing.recordset[0].ConfigJson
      : null;

  await db
    .request()
    .input("id", sql.Int, Number(id))
    .input("name", sql.NVarChar, p.name ?? existing.recordset[0].Name)
    .input("contactType", sql.VarChar, contactType)
    .input("destination", sql.NVarChar, p.destination)
    .input("configJson", sql.NVarChar, configJson)
    .input("isActive", sql.Bit, p.isActive)
    .query(
      "UPDATE AlertContacts SET Name = @name, ContactType = @contactType, Destination = COALESCE(@destination, Destination), ConfigJson = @configJson, IsActive = COALESCE(@isActive, IsActive) WHERE Id = @id"
    );

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_contact_update", details: p.name ?? existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mon = await requireMonitoringPermission("mon_alert_contacts_manage");
  if (!isMonitoringSession(mon)) return mon;

  const { id } = await params;
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, Number(id)).query<{ Name: string }>("SELECT Name FROM AlertContacts WHERE Id = @id");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Alert contact not found" }, { status: 404 });

  await db.request().input("id", sql.Int, Number(id)).query("DELETE FROM AlertContacts WHERE Id = @id");

  await logAdminAction({ admin: mon, section: "monitoring", action: "alert_contact_delete", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

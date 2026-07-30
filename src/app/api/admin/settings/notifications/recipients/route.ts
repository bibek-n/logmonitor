import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { isSystemModule, slugify } from "@/lib/notificationRecipients";

interface RecipientDbRow {
  ModuleKey: string;
  SubModuleKey: string;
  ModuleLabel: string | null;
  SubModuleLabel: string | null;
  Recipients: string;
  Enabled: boolean;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<RecipientDbRow>(
    "SELECT ModuleKey, SubModuleKey, ModuleLabel, SubModuleLabel, Recipients, Enabled FROM NotificationRecipients ORDER BY ModuleLabel ASC, SubModuleLabel ASC"
  );

  const rows = result.recordset.map((r) => ({
    moduleKey: r.ModuleKey,
    subModuleKey: r.SubModuleKey,
    moduleLabel: r.ModuleLabel ?? r.ModuleKey,
    subModuleLabel: r.SubModuleLabel,
    recipients: r.Recipients,
    enabled: r.Enabled,
    isSystem: isSystemModule(r.ModuleKey, r.SubModuleKey),
  }));

  return NextResponse.json({ ok: true, data: rows });
}

// Adds an admin-defined module/sub-module that isn't one of this app's built-in trigger points
// (see NOTIFICATION_MODULES) - not wired to any code path automatically, but gives an admin
// one place to keep a "who gets emailed about what" list even for a notification type this app
// hasn't built native support for yet.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const moduleLabel = typeof body?.moduleLabel === "string" ? body.moduleLabel.trim() : "";
  const subModuleLabel = typeof body?.subModuleLabel === "string" ? body.subModuleLabel.trim() : "";
  const recipients = typeof body?.recipients === "string" ? body.recipients : "";
  const enabled = body?.enabled === undefined ? true : !!body.enabled;

  if (!moduleLabel) {
    return NextResponse.json({ ok: false, error: "Module name is required" }, { status: 400 });
  }

  const db = await getDb();
  const baseModuleKey = slugify(moduleLabel) || "module";
  const baseSubModuleKey = subModuleLabel ? slugify(subModuleLabel) : "";

  // Slugified names collide easily ("Website Alerts" and "website-alerts!" both slugify to the
  // same key) - try the plain slug first, then a numeric suffix, rather than failing outright.
  let moduleKey = baseModuleKey;
  let subModuleKey = baseSubModuleKey;
  let attempt = 1;
  while (attempt <= 20) {
    const existing = await db
      .request()
      .input("moduleKey", sql.VarChar, moduleKey)
      .input("subModuleKey", sql.VarChar, subModuleKey)
      .query<{ Id: number }>("SELECT Id FROM NotificationRecipients WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey");
    if (existing.recordset.length === 0) break;
    attempt++;
    moduleKey = `${baseModuleKey}-${attempt}`;
  }
  if (attempt > 20) {
    return NextResponse.json({ ok: false, error: "A module with a very similar name already exists" }, { status: 409 });
  }

  await db
    .request()
    .input("moduleKey", sql.VarChar, moduleKey)
    .input("subModuleKey", sql.VarChar, subModuleKey)
    .input("moduleLabel", sql.NVarChar, moduleLabel)
    .input("subModuleLabel", sql.NVarChar, subModuleLabel || null)
    .input("recipients", sql.NVarChar, recipients)
    .input("enabled", sql.Bit, enabled)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      INSERT INTO NotificationRecipients (ModuleKey, SubModuleKey, ModuleLabel, SubModuleLabel, Recipients, Enabled, UpdatedByUserId)
      VALUES (@moduleKey, @subModuleKey, @moduleLabel, @subModuleLabel, @recipients, @enabled, @updatedByUserId)
    `);

  await logAdminAction({
    admin,
    section: "notifications",
    action: "add_custom_recipient_module",
    details: `module=${moduleKey}${subModuleKey ? `/${subModuleKey}` : ""}`,
    req,
  });

  return NextResponse.json({ ok: true, data: { moduleKey, subModuleKey, moduleLabel, subModuleLabel: subModuleLabel || null, recipients, enabled, isSystem: false } });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : "";
  const subModuleKey = typeof body?.subModuleKey === "string" ? body.subModuleKey : "";
  const recipients = typeof body?.recipients === "string" ? body.recipients : "";
  const enabled = !!body?.enabled;

  const db = await getDb();
  const result = await db
    .request()
    .input("moduleKey", sql.VarChar, moduleKey)
    .input("subModuleKey", sql.VarChar, subModuleKey)
    .input("recipients", sql.NVarChar, recipients)
    .input("enabled", sql.Bit, enabled)
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE NotificationRecipients SET
        Recipients = @recipients, Enabled = @enabled, UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey
    `);

  if (result.rowsAffected[0] === 0) {
    return NextResponse.json({ ok: false, error: "Module not found" }, { status: 404 });
  }

  await logAdminAction({
    admin,
    section: "notifications",
    action: "update_recipients",
    details: `module=${moduleKey}${subModuleKey ? `/${subModuleKey}` : ""}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const moduleKey = typeof body?.moduleKey === "string" ? body.moduleKey : "";
  const subModuleKey = typeof body?.subModuleKey === "string" ? body.subModuleKey : "";

  if (isSystemModule(moduleKey, subModuleKey)) {
    return NextResponse.json({ ok: false, error: "Built-in modules can't be removed - disable it instead" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("moduleKey", sql.VarChar, moduleKey)
    .input("subModuleKey", sql.VarChar, subModuleKey)
    .query("DELETE FROM NotificationRecipients WHERE ModuleKey = @moduleKey AND SubModuleKey = @subModuleKey");

  await logAdminAction({
    admin,
    section: "notifications",
    action: "delete_custom_recipient_module",
    details: `module=${moduleKey}${subModuleKey ? `/${subModuleKey}` : ""}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

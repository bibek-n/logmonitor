import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { MAINTENANCE_COOKIE } from "@/lib/maintenanceFlag";

export interface SystemSettingsData {
  DefaultTimezone: string | null;
  DefaultLanguage: string | null;
  DateFormat: string | null;
  TimeFormat: string | null;
  MaintenanceModeEnabled: boolean;
  MaintenanceMessage: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<SystemSettingsData>`
    SELECT DefaultTimezone, DefaultLanguage, DateFormat, TimeFormat, MaintenanceModeEnabled, MaintenanceMessage
    FROM CompanySettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const maintenanceEnabled = !!body.maintenanceModeEnabled;

  const db = await getDb();
  await db
    .request()
    .input("defaultTimezone", sql.NVarChar, str(body.defaultTimezone))
    .input("defaultLanguage", sql.NVarChar, str(body.defaultLanguage))
    .input("dateFormat", sql.NVarChar, str(body.dateFormat))
    .input("timeFormat", sql.NVarChar, str(body.timeFormat))
    .input("maintenanceModeEnabled", sql.Bit, maintenanceEnabled)
    .input("maintenanceMessage", sql.NVarChar, str(body.maintenanceMessage))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE CompanySettings SET
        DefaultTimezone = @defaultTimezone, DefaultLanguage = @defaultLanguage, DateFormat = @dateFormat,
        TimeFormat = @timeFormat, MaintenanceModeEnabled = @maintenanceModeEnabled, MaintenanceMessage = @maintenanceMessage,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "system_settings", action: "update_system_settings", details: `maintenance=${maintenanceEnabled}`, req });

  const response = NextResponse.json({ ok: true });
  if (maintenanceEnabled) {
    response.cookies.set(MAINTENANCE_COOKIE, "1", { path: "/", httpOnly: false, sameSite: "lax" });
  } else {
    response.cookies.set(MAINTENANCE_COOKIE, "", { path: "/", maxAge: 0 });
  }
  return response;
}

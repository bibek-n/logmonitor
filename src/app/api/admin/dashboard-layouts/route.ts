import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import type { DashboardLayoutContent, DashboardLayoutSummary } from "@/lib/dashboardLayouts/types";
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from "@/lib/dashboardLayouts/types";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db
    .request()
    .input("userId", sql.Int, admin.userId)
    .query<{ Id: number; Name: string; IsActive: boolean; CreatedAt: string; UpdatedAt: string }>(
      "SELECT Id, Name, IsActive, CreatedAt, UpdatedAt FROM DashboardLayouts WHERE UserId = @userId ORDER BY Name"
    );

  const layouts: DashboardLayoutSummary[] = result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    isActive: r.IsActive,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
  }));

  return NextResponse.json({ ok: true, layouts });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 100) : "";
  const content = body?.content as DashboardLayoutContent | undefined;
  const refreshIntervalSeconds = typeof body?.refreshIntervalSeconds === "number" ? body.refreshIntervalSeconds : DEFAULT_REFRESH_INTERVAL_SECONDS;
  const activate = body?.activate === true;

  if (!name) return NextResponse.json({ ok: false, error: "Layout name is required." }, { status: 400 });
  if (!content || !Array.isArray(content.widgets)) {
    return NextResponse.json({ ok: false, error: "content.widgets array is required." }, { status: 400 });
  }

  const db = await getDb();

  if (activate) {
    await db.request().input("userId", sql.Int, admin.userId).query("UPDATE DashboardLayouts SET IsActive = 0 WHERE UserId = @userId");
  }

  const result = await db
    .request()
    .input("userId", sql.Int, admin.userId)
    .input("name", sql.NVarChar, name)
    .input("isActive", sql.Bit, activate)
    .input("layoutJson", sql.NVarChar, JSON.stringify(content))
    .input("refreshIntervalSeconds", sql.Int, refreshIntervalSeconds)
    .query<{ Id: number }>(
      `INSERT INTO DashboardLayouts (UserId, Name, IsActive, LayoutJson, RefreshIntervalSeconds)
       OUTPUT INSERTED.Id
       VALUES (@userId, @name, @isActive, @layoutJson, @refreshIntervalSeconds)`
    );

  return NextResponse.json({ ok: true, id: result.recordset[0].Id });
}

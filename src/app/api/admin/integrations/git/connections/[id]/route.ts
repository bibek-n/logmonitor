import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { logAdminAction } from "@/lib/adminAudit";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid connection id" }, { status: 400 });

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{ Name: string; Provider: string }>("SELECT Name, Provider FROM RepoConnections WHERE Id = @id AND DeletedAt IS NULL");
  if (!existing.recordset[0]) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  // Soft delete only, same convention as every other table in this app - projects that still
  // reference this connection keep their RepoConnectionId until an admin repoints or removes
  // them; the next scan attempt fails with a clear "connection no longer exists" error rather
  // than silently reading a stale token.
  await db.request().input("id", sql.Int, id).query("UPDATE RepoConnections SET DeletedAt = SYSUTCDATETIME() WHERE Id = @id");

  await logAdminAction({ admin: session, section: "integrations", action: "git_connection_delete", details: `Removed ${existing.recordset[0].Provider} connection "${existing.recordset[0].Name}".`, req });

  return NextResponse.json({ ok: true });
}

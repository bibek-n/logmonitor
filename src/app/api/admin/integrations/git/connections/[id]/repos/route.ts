import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { listReposForConnection } from "@/lib/repoConnections/client";
import type { RepoConnectionRow } from "@/lib/repoConnections/types";

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface ConnectionRow {
  Id: number;
  Provider: "GitHub" | "GitLab";
  AuthMethod: "PAT" | "OAuthApp" | "GitHubApp";
  InstanceUrl: string | null;
  AccessTokenEncrypted: string | null;
  InstallationId: number | null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireIntegrationPermission("integrations_git_view");
  if (!isIntegrationSession(session)) return session;

  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) return NextResponse.json({ ok: false, error: "Invalid connection id" }, { status: 400 });

  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<ConnectionRow>("SELECT Id, Provider, AuthMethod, InstanceUrl, AccessTokenEncrypted, InstallationId FROM RepoConnections WHERE Id = @id AND DeletedAt IS NULL");
  const row = result.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  const connection: RepoConnectionRow = {
    id: row.Id,
    provider: row.Provider,
    authMethod: row.AuthMethod,
    instanceUrl: row.InstanceUrl,
    accessTokenEncrypted: row.AccessTokenEncrypted,
    installationId: row.InstallationId,
  };

  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const search = sp.get("search") ?? undefined;

  try {
    const { repos, hasMore } = await listReposForConnection(connection, { page, search });
    return NextResponse.json({ ok: true, data: { repos, hasMore } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : `Failed to list repositories from ${row.Provider}.` }, { status: 502 });
  }
}

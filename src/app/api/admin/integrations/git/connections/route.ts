import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { createRepoConnectionSchema } from "@/lib/repoConnectionsShared";
import { verifyConnectionToken } from "@/lib/repoConnections/client";

// Token-free responses - AccessTokenEncrypted/RefreshTokenEncrypted never leave the server,
// regardless of which module is asking (this route is shared by all of them).
export async function GET(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_view");
  if (!isIntegrationSession(session)) return session;

  const provider = req.nextUrl.searchParams.get("provider");
  const db = await getDb();
  const request = db.request();
  const conditions = ["DeletedAt IS NULL"];
  if (provider === "GitHub" || provider === "GitLab") {
    conditions.push("Provider = @provider");
    request.input("provider", sql.VarChar, provider);
  }

  const result = await request.query(`
    SELECT Id, Provider, Name, AuthMethod, InstanceUrl, OwnerLogin, InstallationId, ScopesGranted,
      CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM RepoConnections WHERE ${conditions.join(" AND ")} ORDER BY CreatedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

// PAT method only - OAuth App and GitHub App connections are created by their own
// start/callback route pairs (github/oauth/*, github/app/*), never through this POST.
export async function POST(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const body = await req.json().catch(() => null);
  const parsed = createRepoConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request body." }, { status: 400 });
  }
  const input = parsed.data;

  let ownerLogin: string;
  try {
    const verified = await verifyConnectionToken(input.provider, input.token, input.provider === "GitLab" ? input.instanceUrl : undefined);
    ownerLogin = verified.ownerLogin;
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : `Failed to validate token with ${input.provider}.` }, { status: 400 });
  }

  const { encryptGitHubToken } = await import("@/lib/repoConnections/github/crypto");
  const { encryptGitLabToken } = await import("@/lib/repoConnections/gitlab/crypto");
  const encryptedToken = input.provider === "GitHub" ? encryptGitHubToken(input.token) : encryptGitLabToken(input.token);

  const db = await getDb();
  const result = await db
    .request()
    .input("provider", sql.VarChar, input.provider)
    .input("name", sql.NVarChar, input.name)
    .input("instanceUrl", sql.NVarChar, input.provider === "GitLab" ? input.instanceUrl.replace(/\/+$/, "") : null)
    .input("ownerLogin", sql.NVarChar, ownerLogin)
    .input("accessToken", sql.NVarChar, encryptedToken)
    .input("createdBy", sql.Int, session.userId)
    .query<{ Id: number }>(`
      INSERT INTO RepoConnections (Provider, Name, AuthMethod, InstanceUrl, OwnerLogin, AccessTokenEncrypted, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@provider, @name, 'PAT', @instanceUrl, @ownerLogin, @accessToken, @createdBy)
    `);

  await logAdminAction({ admin: session, section: "integrations", action: "git_connection_create", details: `Added ${input.provider} connection "${input.name}" (${ownerLogin}).`, req });

  return NextResponse.json({ ok: true, data: { id: result.recordset[0].Id, ownerLogin } }, { status: 201 });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getGitHubAppConfig, getInstallationOwnerLogin, APP_STATE_COOKIE } from "@/lib/repoConnections/github/githubApp";
import { unpackState, sanitizeReturnTo } from "@/lib/repoConnections/returnTo";

export async function GET(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const config = getGitHubAppConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "GitHub App is not configured." }, { status: 501 });
  }

  const sp = req.nextUrl.searchParams;
  const installationId = sp.get("installation_id");
  const state = sp.get("state");
  const cookieState = unpackState(req.cookies.get(APP_STATE_COOKIE)?.value);

  const failRedirect = (reason: string, returnTo: string) => {
    const url = new URL(sanitizeReturnTo(returnTo), req.nextUrl.origin);
    url.searchParams.set("gitError", reason);
    const res = NextResponse.redirect(url);
    res.cookies.delete(APP_STATE_COOKIE);
    return res;
  };

  if (!installationId || !state || !cookieState || state !== cookieState.state) {
    return failRedirect("Invalid or expired GitHub App installation request. Please try connecting again.", cookieState?.returnTo ?? "");
  }

  const installationIdNum = Number(installationId);
  if (!Number.isInteger(installationIdNum) || installationIdNum <= 0) {
    return failRedirect("GitHub sent an invalid installation id.", cookieState.returnTo);
  }

  try {
    const ownerLogin = await getInstallationOwnerLogin(config, installationIdNum);

    const db = await getDb();
    // An install callback can also fire for setup_action=update (repo selection changed on
    // an existing installation) - update the existing row for that installation instead of
    // inserting a duplicate connection.
    const existing = await db
      .request()
      .input("installationId", sql.BigInt, installationIdNum)
      .query<{ Id: number }>("SELECT Id FROM RepoConnections WHERE Provider = 'GitHub' AND InstallationId = @installationId AND DeletedAt IS NULL");

    if (existing.recordset[0]) {
      await db
        .request()
        .input("id", sql.Int, existing.recordset[0].Id)
        .input("ownerLogin", sql.NVarChar, ownerLogin)
        .query("UPDATE RepoConnections SET OwnerLogin = @ownerLogin, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
    } else {
      await db
        .request()
        .input("name", sql.NVarChar, `GitHub App (${ownerLogin ?? "installation " + installationIdNum})`)
        .input("ownerLogin", sql.NVarChar, ownerLogin)
        .input("installationId", sql.BigInt, installationIdNum)
        .input("createdBy", sql.Int, session.userId)
        .query(`
          INSERT INTO RepoConnections (Provider, Name, AuthMethod, OwnerLogin, InstallationId, CreatedByUserId)
          VALUES ('GitHub', @name, 'GitHubApp', @ownerLogin, @installationId, @createdBy)
        `);
    }

    await logAdminAction({
      admin: session,
      section: "integrations",
      action: "git_connection_create",
      details: `Installed GitHub App for "${ownerLogin ?? installationIdNum}" (installation ${installationIdNum}).`,
      req,
    });

    const url = new URL(cookieState.returnTo, req.nextUrl.origin);
    url.searchParams.set("gitConnected", ownerLogin ?? String(installationIdNum));
    const res = NextResponse.redirect(url);
    res.cookies.delete(APP_STATE_COOKIE);
    return res;
  } catch (err) {
    return failRedirect(err instanceof Error ? err.message : "GitHub App connection failed.", cookieState.returnTo);
  }
}

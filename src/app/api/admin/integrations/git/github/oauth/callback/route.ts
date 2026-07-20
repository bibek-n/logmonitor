import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { getOAuthAppConfig, exchangeCodeForToken, OAUTH_STATE_COOKIE } from "@/lib/repoConnections/github/oauthApp";
import { verifyTokenAndGetUser } from "@/lib/repoConnections/github/client";
import { encryptGitHubToken } from "@/lib/repoConnections/github/crypto";
import { unpackState, sanitizeReturnTo } from "@/lib/repoConnections/returnTo";

export async function GET(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const config = getOAuthAppConfig();
  if (!config) {
    return NextResponse.json({ ok: false, error: "GitHub OAuth App is not configured." }, { status: 501 });
  }

  const sp = req.nextUrl.searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const cookieState = unpackState(req.cookies.get(OAUTH_STATE_COOKIE)?.value);

  const failRedirect = (reason: string, returnTo: string) => {
    const url = new URL(sanitizeReturnTo(returnTo), req.nextUrl.origin);
    url.searchParams.set("gitError", reason);
    const res = NextResponse.redirect(url);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  };

  if (!code || !state || !cookieState || state !== cookieState.state) {
    return failRedirect("Invalid or expired GitHub authorization request. Please try connecting again.", cookieState?.returnTo ?? "");
  }

  try {
    const token = await exchangeCodeForToken(config, code);
    const user = await verifyTokenAndGetUser(token.accessToken);

    const db = await getDb();
    await db
      .request()
      .input("name", sql.NVarChar, `GitHub OAuth (${user.login})`)
      .input("ownerLogin", sql.NVarChar, user.login)
      .input("accessToken", sql.NVarChar, encryptGitHubToken(token.accessToken))
      .input("refreshToken", sql.NVarChar, token.refreshToken ? encryptGitHubToken(token.refreshToken) : null)
      .input("expiresAt", sql.DateTime2, token.expiresAt)
      .input("scopes", sql.NVarChar, token.scopes)
      .input("createdBy", sql.Int, session.userId)
      .query(`
        INSERT INTO RepoConnections (Provider, Name, AuthMethod, OwnerLogin, AccessTokenEncrypted, RefreshTokenEncrypted, TokenExpiresAt, ScopesGranted, CreatedByUserId)
        VALUES ('GitHub', @name, 'OAuthApp', @ownerLogin, @accessToken, @refreshToken, @expiresAt, @scopes, @createdBy)
      `);

    await logAdminAction({ admin: session, section: "integrations", action: "git_connection_create", details: `Connected GitHub account "${user.login}" via OAuth App.`, req });

    const url = new URL(cookieState.returnTo, req.nextUrl.origin);
    url.searchParams.set("gitConnected", user.login);
    const res = NextResponse.redirect(url);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  } catch (err) {
    return failRedirect(err instanceof Error ? err.message : "GitHub connection failed.", cookieState.returnTo);
  }
}

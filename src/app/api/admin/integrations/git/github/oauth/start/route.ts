import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { getOAuthAppConfig, buildAuthorizeUrl, OAUTH_STATE_COOKIE } from "@/lib/repoConnections/github/oauthApp";
import { sanitizeReturnTo, packState } from "@/lib/repoConnections/returnTo";

export async function GET(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const config = getOAuthAppConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "GitHub OAuth App is not configured. Set GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, and GITHUB_OAUTH_REDIRECT_URI." },
      { status: 501 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const res = NextResponse.redirect(buildAuthorizeUrl(config, state));
  // Short-lived, httpOnly - only ever read back by the callback route below to defeat CSRF on
  // the OAuth redirect; never readable by client JS and never persisted anywhere else.
  // `secure: true` is safe to hard-code: GitHub rejects non-HTTPS redirect_uri values outside
  // localhost, so this flow is only ever reachable via the site's HTTPS binding in practice.
  res.cookies.set(OAUTH_STATE_COOKIE, packState(state, returnTo), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/admin/integrations/git" });
  return res;
}

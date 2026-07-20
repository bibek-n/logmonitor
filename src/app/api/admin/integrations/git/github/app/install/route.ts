import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { getGitHubAppConfig, buildInstallUrl, APP_STATE_COOKIE } from "@/lib/repoConnections/github/githubApp";
import { sanitizeReturnTo, packState } from "@/lib/repoConnections/returnTo";

export async function GET(req: NextRequest) {
  const session = await requireIntegrationPermission("integrations_git_manage");
  if (!isIntegrationSession(session)) return session;

  const config = getGitHubAppConfig();
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "GitHub App is not configured. Set GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY." },
      { status: 501 }
    );
  }

  const state = crypto.randomBytes(16).toString("hex");
  const returnTo = sanitizeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const res = NextResponse.redirect(buildInstallUrl(config, state));
  res.cookies.set(APP_STATE_COOKIE, packState(state, returnTo), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/admin/integrations/git" });
  return res;
}

import { NextResponse } from "next/server";
import { requireIntegrationPermission, isIntegrationSession } from "@/lib/requireIntegrationPermission";
import { getOAuthAppConfig } from "@/lib/repoConnections/github/oauthApp";
import { getGitHubAppConfig } from "@/lib/repoConnections/github/githubApp";

// Booleans only - never echoes back the actual client id/secret/private key, even to an
// authorized admin. Drives which "Connect with GitHub" options any module's connect UI shows
// as available vs. "ask your administrator to configure this."
export async function GET() {
  const session = await requireIntegrationPermission("integrations_git_view");
  if (!isIntegrationSession(session)) return session;

  return NextResponse.json({
    ok: true,
    data: {
      pat: true,
      oauthApp: getOAuthAppConfig() !== null,
      githubApp: getGitHubAppConfig() !== null,
    },
  });
}

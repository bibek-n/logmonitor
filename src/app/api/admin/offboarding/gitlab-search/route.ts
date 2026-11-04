import { NextRequest, NextResponse } from "next/server";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { searchUsers } from "@/lib/offboarding/gitlabClient";
import { getDecryptedOffboardingCredentials } from "@/lib/offboarding/settingsRepository";

// Lets the mapping UI resolve a typed name/username to a real GitLab user id - offboarding
// itself always acts on the stored numeric id (gitlabUserId), never on username alone, since a
// username is reassignable but an id is not. Not employee-scoped (search is global), so it's its
// own top-level route rather than nested under employees/[id].
export async function GET(req: NextRequest) {
  const off = await requireOffboardingPermission("off_manage_mappings");
  if (!isOffboardingSession(off)) return off;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ ok: true, data: [] });

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.gitlabBaseUrl || !creds.gitlabToken) {
    return NextResponse.json({ ok: false, error: "GitLab is not configured yet - set it up under Offboarding Settings." }, { status: 400 });
  }

  try {
    const users = await searchUsers(creds.gitlabBaseUrl, creds.gitlabToken, q);
    return NextResponse.json({ ok: true, data: users });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "GitLab search failed." }, { status: 400 });
  }
}

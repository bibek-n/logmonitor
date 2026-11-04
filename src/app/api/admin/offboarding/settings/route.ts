import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { getOffboardingSettings, updateOffboardingSettings, getDecryptedOffboardingCredentials } from "@/lib/offboarding/settingsRepository";
import { verifyAdminToken } from "@/lib/offboarding/gitlabClient";

export async function GET() {
  const off = await requireOffboardingPermission("off_settings_manage");
  if (!isOffboardingSession(off)) return off;

  const settings = await getOffboardingSettings();
  return NextResponse.json({ ok: true, data: settings });
}

const updateSchema = z.object({
  gitlabBaseUrl: z.string().optional(),
  gitlabToken: z.string().optional(),
  glesysApiUser: z.string().optional(),
  glesysApiKey: z.string().optional(),
  agentQaApiUrl: z.string().optional(),
  agentQaApiKey: z.string().optional(),
  teamworkApiUrl: z.string().optional(),
  teamworkApiKey: z.string().optional(),
  adBindDn: z.string().optional(),
  adBindPassword: z.string().optional(),
});

export async function PATCH(req: NextRequest) {
  const off = await requireOffboardingPermission("off_settings_manage");
  if (!isOffboardingSession(off)) return off;

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  // A new GitLab token is verified against the real API before being stored - saving a typo'd
  // or non-admin token silently would only surface as a confusing failure during a real, later
  // offboarding, the worst possible time to discover it.
  if (parsed.data.gitlabToken) {
    const baseUrl = parsed.data.gitlabBaseUrl ?? (await getOffboardingSettings()).gitlabBaseUrl;
    if (!baseUrl) return NextResponse.json({ ok: false, error: "Set the GitLab base URL together with the token." }, { status: 400 });
    try {
      await verifyAdminToken(baseUrl, parsed.data.gitlabToken);
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Could not verify the GitLab token." }, { status: 400 });
    }
  }

  await updateOffboardingSettings(parsed.data, off.userId);
  await logAdminAction({ admin: off, section: "offboarding", action: "update_settings", details: Object.keys(parsed.data).join(", ") });

  return NextResponse.json({ ok: true });
}

// Lets the settings page confirm Glesys credentials work without having to wait for a real
// offboarding - lists accounts for a domain the admin provides, which is itself a real,
// documented capability (not a synthetic "ping" call).
const glesysTestSchema = z.object({ testGlesysDomain: z.string().min(1) });

// Same idea for Active Directory - looks up one real account (read-only: a search + a bind, no
// modify) so a bad bind DN/password/OU-scope surfaces on the settings page, not during a real
// offboarding.
const adTestSchema = z.object({ testAdUsername: z.string().min(1) });

export async function POST(req: NextRequest) {
  const off = await requireOffboardingPermission("off_settings_manage");
  if (!isOffboardingSession(off)) return off;

  const body = await req.json().catch(() => null);

  const adParsed = adTestSchema.safeParse(body);
  if (adParsed.success) {
    const creds = await getDecryptedOffboardingCredentials();
    if (!creds.adBindDn || !creds.adBindPassword) {
      return NextResponse.json({ ok: false, error: "Active Directory bind credentials are not saved yet." }, { status: 400 });
    }
    const server = process.env.AD_SERVER;
    const baseDn = process.env.AD_BASE_DN;
    if (!server || !baseDn) {
      return NextResponse.json({ ok: false, error: "AD_SERVER/AD_BASE_DN are not configured on the server (same env vars the AD Sync feature uses)." }, { status: 400 });
    }
    try {
      const { lookupAdAccount } = await import("@/lib/offboarding/activeDirectoryClient");
      const result = await lookupAdAccount(server, baseDn, creds.adBindDn, creds.adBindPassword, adParsed.data.testAdUsername);
      if (!result.found) return NextResponse.json({ ok: false, error: `No AD account found for "${adParsed.data.testAdUsername}".` }, { status: 400 });
      return NextResponse.json({ ok: true, data: { disabled: result.disabled, distinguishedName: result.distinguishedName } });
    } catch (err) {
      return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "AD test lookup failed." }, { status: 400 });
    }
  }

  const parsed = glesysTestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "domain is required" }, { status: 400 });

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.glesysApiUser || !creds.glesysApiKey) {
    return NextResponse.json({ ok: false, error: "Glesys credentials are not saved yet." }, { status: 400 });
  }

  try {
    const { listEmailAccounts } = await import("@/lib/offboarding/glesysClient");
    const accounts = await listEmailAccounts(creds.glesysApiUser, creds.glesysApiKey, parsed.data.testGlesysDomain);
    return NextResponse.json({ ok: true, data: { accountCount: accounts.length } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Glesys test call failed." }, { status: 400 });
  }
}

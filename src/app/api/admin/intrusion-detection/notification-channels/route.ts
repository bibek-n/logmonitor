import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { listChannels, createChannel, CHANNEL_TYPES, type ChannelType, type ChannelConfig } from "@/lib/intrusionDetection/notificationChannels";
import { SEVERITY_ORDER, type Severity } from "@/lib/intrusionDetection/shared";

// Channel config is never returned here (see notificationChannels.ts's decryptConfig comment) -
// listChannels() only exposes hasConfig: boolean, so a compromised admin session can't
// exfiltrate webhook URLs/signing secrets just by viewing this settings page.
export async function GET() {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const channels = await listChannels();
  return NextResponse.json({ ok: true, data: channels });
}

function validateConfig(channelType: ChannelType, config: unknown): ChannelConfig | null {
  if (typeof config !== "object" || config === null) return null;
  const c = config as Record<string, unknown>;
  if ((channelType === "slack" || channelType === "teams") && typeof c.webhookUrl === "string" && c.webhookUrl.trim()) {
    return { webhookUrl: c.webhookUrl.trim() };
  }
  if (channelType === "webhook" && typeof c.url === "string" && c.url.trim()) {
    return { url: c.url.trim(), signingSecret: typeof c.signingSecret === "string" && c.signingSecret.trim() ? c.signingSecret.trim() : null };
  }
  if (channelType === "email" && typeof c.to === "string" && c.to.trim()) {
    return { to: c.to.trim() };
  }
  if (channelType === "in_app" && typeof c.username === "string" && c.username.trim()) {
    return { username: c.username.trim() };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const channelType = body?.channelType as ChannelType;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const minSeverity = body?.minSeverity as Severity;

  if (!CHANNEL_TYPES.includes(channelType)) return NextResponse.json({ ok: false, error: "Invalid channelType." }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  if (!SEVERITY_ORDER.includes(minSeverity)) return NextResponse.json({ ok: false, error: "Invalid minSeverity." }, { status: 400 });

  const config = validateConfig(channelType, body?.config);
  if (!config) return NextResponse.json({ ok: false, error: "Invalid or incomplete config for this channel type." }, { status: 400 });

  const id = await createChannel({ channelType, name, config, minSeverity });
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "notification_channel_create", details: `${channelType}: ${name}`, req });
  return NextResponse.json({ ok: true, data: { id } });
}

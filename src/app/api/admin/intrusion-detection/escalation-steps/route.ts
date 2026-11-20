import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { listEscalationSteps, createEscalationStep } from "@/lib/intrusionDetection/notificationChannels";

export async function GET() {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const steps = await listEscalationSteps();
  return NextResponse.json({ ok: true, data: steps });
}

function parseChannelIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.map((v) => Number(v));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return ids;
}

export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const stepOrder = Number(body?.stepOrder);
  const delayMinutes = Number(body?.delayMinutes);
  const channelIds = parseChannelIds(body?.channelIds ?? []);

  if (!Number.isInteger(stepOrder) || stepOrder <= 0) return NextResponse.json({ ok: false, error: "stepOrder must be a positive integer." }, { status: 400 });
  if (!Number.isInteger(delayMinutes) || delayMinutes <= 0) return NextResponse.json({ ok: false, error: "delayMinutes must be a positive integer." }, { status: 400 });
  if (!channelIds) return NextResponse.json({ ok: false, error: "channelIds must be an array of positive integers." }, { status: 400 });

  const id = await createEscalationStep({ stepOrder, delayMinutes, channelIds });
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "escalation_step_create", details: `Step #${id}: +${delayMinutes}m`, req });
  return NextResponse.json({ ok: true, data: { id } });
}

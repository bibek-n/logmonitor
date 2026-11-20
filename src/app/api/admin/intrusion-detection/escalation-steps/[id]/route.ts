import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { updateEscalationStep, deleteEscalationStep } from "@/lib/intrusionDetection/notificationChannels";

function parseChannelIds(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.map((v) => Number(v));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return ids;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const stepId = Number(id);
  if (!Number.isInteger(stepId) || stepId <= 0) return NextResponse.json({ ok: false, error: "Invalid step id." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const patch: Parameters<typeof updateEscalationStep>[1] = {};
  if (body?.stepOrder !== undefined) {
    const v = Number(body.stepOrder);
    if (!Number.isInteger(v) || v <= 0) return NextResponse.json({ ok: false, error: "stepOrder must be a positive integer." }, { status: 400 });
    patch.stepOrder = v;
  }
  if (body?.delayMinutes !== undefined) {
    const v = Number(body.delayMinutes);
    if (!Number.isInteger(v) || v <= 0) return NextResponse.json({ ok: false, error: "delayMinutes must be a positive integer." }, { status: 400 });
    patch.delayMinutes = v;
  }
  if (body?.channelIds !== undefined) {
    const ids = parseChannelIds(body.channelIds);
    if (!ids) return NextResponse.json({ ok: false, error: "channelIds must be an array of positive integers." }, { status: 400 });
    patch.channelIds = ids;
  }

  await updateEscalationStep(stepId, patch);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "escalation_step_update", details: `Step #${stepId}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const stepId = Number(id);
  if (!Number.isInteger(stepId) || stepId <= 0) return NextResponse.json({ ok: false, error: "Invalid step id." }, { status: 400 });

  await deleteEscalationStep(stepId);
  await logAdminAction({ admin: session, section: "intrusion-detection", action: "escalation_step_delete", details: `Step #${stepId}`, req });
  return NextResponse.json({ ok: true });
}

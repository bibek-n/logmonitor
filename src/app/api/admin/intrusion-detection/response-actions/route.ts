import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { listActions, requestAction, RESPONSE_ACTION_TYPES, type ResponseActionType } from "@/lib/intrusionDetection/responseActions";

export async function GET(req: NextRequest) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const sp = req.nextUrl.searchParams;
  const actions = await listActions({
    status: sp.get("status") ?? undefined,
    alertId: sp.get("alertId") ? Number(sp.get("alertId")) : undefined,
  });
  return NextResponse.json({ ok: true, data: actions });
}

// Dry-run (dryRun: true, the default) only records the request - see responseActions.ts's
// requestAction() doc comment. A separate POST to [id]/execute is always required to actually
// do anything, even when dryRun is explicitly set to false at request time.
export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const actionType = body?.actionType as ResponseActionType;
  const targetValue = typeof body?.targetValue === "string" ? body.targetValue.trim() : "";
  const alertId = Number.isInteger(body?.alertId) ? Number(body.alertId) : null;
  const dryRun = body?.dryRun !== false;
  const expiresInHours = Number.isFinite(body?.expiresInHours) ? Number(body.expiresInHours) : null;

  if (!RESPONSE_ACTION_TYPES.includes(actionType)) {
    return NextResponse.json({ ok: false, error: `Invalid actionType. Must be one of: ${RESPONSE_ACTION_TYPES.join(", ")}.` }, { status: 400 });
  }
  if (!targetValue) return NextResponse.json({ ok: false, error: "targetValue is required." }, { status: 400 });

  const result = await requestAction({
    alertId,
    actionType,
    targetValue,
    requestedByUserId: session.userId,
    requestedByUsername: session.username,
    dryRun,
    expiresAt: expiresInHours ? new Date(Date.now() + expiresInHours * 3600 * 1000) : null,
  });
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "response_action_request", details: `${actionType}: ${targetValue} (dryRun=${dryRun})`, req });
  return NextResponse.json({ ok: true, data: { id: result.id } });
}

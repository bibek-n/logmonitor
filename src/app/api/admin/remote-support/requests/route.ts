import { NextRequest, NextResponse } from "next/server";
import { requireRemoteSupportPermission, isRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { createSessionRequest } from "@/lib/remoteSupport/sessionAuthorization";
import { checkRateLimit } from "@/lib/remoteSupport/rateLimiter";
import { SessionStateError } from "@/lib/remoteSupport/types";

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : "unknown";
}

const ERROR_STATUS: Record<string, number> = {
  REASON_REQUIRED: 400,
  REASON_TOO_LONG: 400,
  DEVICE_NOT_FOUND: 404,
  DEVICE_OFFLINE: 409,
  DEVICE_BUSY: 409,
};

// "view" is implicit and always included - control/file_transfer are the only ones the admin
// console's request modal actually offers as opt-in checkboxes (see requirePermission checks
// on remote_support_control/remote_support_file_transfer downstream: this list only decides
// what's grantABLE for the session, sessionAuthorization/file-transfers routes still enforce
// it independently).
const OPTIONAL_PERMISSIONS = ["control", "file_transfer"];

function normalizePermissions(input: unknown): string {
  const requested = Array.isArray(input) ? input.filter((v): v is string => typeof v === "string") : [];
  const granted = new Set(["view"]);
  for (const p of requested) {
    if (OPTIONAL_PERMISSIONS.includes(p)) granted.add(p);
  }
  return Array.from(granted).join(",");
}

export async function POST(req: NextRequest) {
  const rs = await requireRemoteSupportPermission("remote_support_request");
  if (!isRemoteSupportSession(rs)) return rs;

  if (!checkRateLimit(rs.userId)) {
    return NextResponse.json({ ok: false, error: "Too many session requests - please wait a moment and try again" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "deviceId is required" }, { status: 400 });
  }
  const permissions = normalizePermissions(body?.permissions);

  try {
    const result = await createSessionRequest({
      deviceId,
      requestedByUserId: rs.userId,
      reason,
      sourceIp: clientIp(req),
      permissions,
    });

    await logAdminAction({
      admin: rs,
      section: "remote-support",
      action: "request_session",
      details: `device=${deviceId} sessionId=${result.sessionId}`,
      req,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SessionStateError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: ERROR_STATUS[err.code] ?? 400 });
    }
    throw err;
  }
}

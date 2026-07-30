import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { listAuditLog } from "@/lib/remoteAccess/auditLog";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_audit_logs_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const eventType = req.nextUrl.searchParams.get("eventType") ?? undefined;
  const userIdParam = req.nextUrl.searchParams.get("userId");
  const limitParam = req.nextUrl.searchParams.get("limit");

  const logs = await listAuditLog({
    eventType,
    userId: userIdParam ? Number(userIdParam) : undefined,
    limit: limitParam ? Number(limitParam) : undefined,
  });
  return NextResponse.json({ ok: true, data: logs });
}

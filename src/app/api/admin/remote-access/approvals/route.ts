import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { listApprovalRequests } from "@/lib/remoteAccess/repository";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_bulk_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  return NextResponse.json({ ok: true, data: await listApprovalRequests(status) });
}

import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { testConnection } from "@/lib/remoteAccess/connectionService";

// Shares its implementation with the scheduled Connection Checker (scripts/run-remote-access-
// connection-check.ts via connectionService.checkTcpReachability) - one reachability
// implementation, not two that could drift.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  try {
    const result = await testConnection(Number(id));
    await logAdminAction({ admin: ra, section: "remote-access", action: "connection_test", details: `Connection #${id}: ${result.status}`, req });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Test failed" }, { status: 400 });
  }
}

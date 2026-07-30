import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { cloneConnection } from "@/lib/remoteAccess/repository";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_create");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  try {
    const newId = await cloneConnection(Number(id), ra.userId);
    await logAdminAction({ admin: ra, section: "remote-access", action: "connection_clone", details: `Connection #${id} -> #${newId}`, req });
    return NextResponse.json({ ok: true, data: { id: newId } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Clone failed" }, { status: 400 });
  }
}

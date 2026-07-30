import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { updateConnectionSchema } from "@/lib/remoteAccess/schema";
import { deleteConnection, getConnection, updateConnection } from "@/lib/remoteAccess/repository";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const connection = await getConnection(Number(id));
  if (!connection) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: connection });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_edit");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid connection payload" }, { status: 400 });
  }

  try {
    await updateConnection(Number(id), parsed.data, ra.userId);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Update failed" }, { status: 400 });
  }

  await logAdminAction({ admin: ra, section: "remote-access", action: "connection_update", details: `Connection #${id}`, req });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_connections_delete");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const existing = await getConnection(Number(id));
  if (!existing) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });

  await deleteConnection(Number(id));
  await logAdminAction({ admin: ra, section: "remote-access", action: "connection_delete", details: existing.name, req });
  return NextResponse.json({ ok: true });
}

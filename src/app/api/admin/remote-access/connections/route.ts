import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createConnectionSchema } from "@/lib/remoteAccess/schema";
import { createConnection, listConnections } from "@/lib/remoteAccess/repository";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_connections_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const environment = req.nextUrl.searchParams.get("environment") ?? undefined;
  const protocol = req.nextUrl.searchParams.get("protocol") ?? undefined;
  const groupIdParam = req.nextUrl.searchParams.get("groupId");
  const groupId = groupIdParam ? Number(groupIdParam) : undefined;

  const connections = await listConnections({ search, environment, protocol, groupId, viewerUserId: ra.userId, isAdmin: ra.role === "Admin" });
  return NextResponse.json({ ok: true, data: connections });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_connections_create");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid connection payload" }, { status: 400 });
  }

  const id = await createConnection(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "connection_create", details: `${parsed.data.name} (${parsed.data.protocol})`, req });

  return NextResponse.json({ ok: true, data: { id } });
}

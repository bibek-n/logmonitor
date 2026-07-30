import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createGroupSchema } from "@/lib/remoteAccess/schema";
import { createGroup, listGroups } from "@/lib/remoteAccess/repository";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_connections_view");
  if (!isRemoteAccessSession(ra)) return ra;

  return NextResponse.json({ ok: true, data: await listGroups() });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_connections_create");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid group payload" }, { status: 400 });
  }

  const id = await createGroup(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "group_create", details: parsed.data.name, req });
  return NextResponse.json({ ok: true, data: { id } });
}

import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { createPortForwardSchema } from "@/lib/remoteAccess/schema";
import { createPortForward, listPortForwards } from "@/lib/remoteAccess/repository";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_port_forwarding_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const connectionIdParam = req.nextUrl.searchParams.get("connectionId");
  const forwards = await listPortForwards(connectionIdParam ? Number(connectionIdParam) : undefined);
  return NextResponse.json({ ok: true, data: forwards });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_port_forwarding_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = createPortForwardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid port forward request" }, { status: 400 });
  }

  const id = await createPortForward(parsed.data, ra.userId);
  await logAdminAction({ admin: ra, section: "remote-access", action: "port_forward_create", details: `${parsed.data.forwardType} :${parsed.data.localPort}`, req });
  return NextResponse.json({ ok: true, data: { id } });
}

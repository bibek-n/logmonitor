import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { startVncSession } from "@/lib/remoteAccess/vncSessionService";

const startSessionSchema = z.object({ connectionId: z.number().int().positive() });

// "Connect" on a saved VNC connection - mirrors POST /sessions (Terminal's "Open Terminal")
// but as its own route since VNC sessions are managed by vncSessionService, not
// connectionService, and the response carries the framebuffer size the viewer needs upfront.
export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_vnc_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "connectionId is required" }, { status: 400 });
  }

  try {
    const result = await startVncSession({ connectionId: parsed.data.connectionId, userId: ra.userId, username: ra.username });
    await logAdminAction({ admin: ra, section: "remote-access", action: "vnc_session_start", details: `Connection #${parsed.data.connectionId} -> session #${result.sessionId}`, req });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start VNC session" }, { status: 400 });
  }
}

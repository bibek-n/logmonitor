import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { startRdpSession } from "@/lib/remoteAccess/rdpSessionService";

const startSessionSchema = z.object({
  connectionId: z.number().int().positive(),
  width: z.number().int().min(320).max(3840).optional(),
  height: z.number().int().min(240).max(2160).optional(),
});

// "Connect" on a saved RDP connection - mirrors sessions/vnc/route.ts exactly, just backed by
// rdpSessionService (guacd) instead of vncSessionService (direct RFB).
export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_rdp_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "connectionId is required" }, { status: 400 });
  }

  try {
    const result = await startRdpSession({
      connectionId: parsed.data.connectionId,
      userId: ra.userId,
      username: ra.username,
      width: parsed.data.width,
      height: parsed.data.height,
    });
    await logAdminAction({ admin: ra, section: "remote-access", action: "rdp_session_start", details: `Connection #${parsed.data.connectionId} -> session #${result.sessionId}`, req });
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start RDP session" }, { status: 400 });
  }
}

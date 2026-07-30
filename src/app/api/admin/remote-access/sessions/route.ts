import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { startTerminalSession } from "@/lib/remoteAccess/connectionService";
import { z } from "zod";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const db = await getDb();
  const result = await db.query<{
    Id: number;
    ConnectionId: number | null;
    ConnectionName: string | null;
    SessionType: string;
    Protocol: string;
    TargetHost: string;
    StartedByUserId: number;
    StartedByUsername: string | null;
    StartedAt: Date;
    EndedAt: Date | null;
    Status: string;
    RecordingStatus: string;
  }>(`
    SELECT TOP 200 s.Id, s.ConnectionId, c.Name AS ConnectionName, s.SessionType, s.Protocol, s.TargetHost,
      s.StartedByUserId, s.StartedByUsername, s.StartedAt, s.EndedAt, s.Status, s.RecordingStatus
    FROM RemoteSessions s LEFT JOIN RemoteConnections c ON c.Id = s.ConnectionId
    ORDER BY s.StartedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

const startSessionSchema = z.object({ connectionId: z.number().int().positive() });

// "Open Terminal" from a saved connection (as opposed to Quick Connect's ad-hoc form).
export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "connectionId is required" }, { status: 400 });
  }

  try {
    const sessionId = await startTerminalSession({ connectionId: parsed.data.connectionId, userId: ra.userId, username: ra.username });
    await logAdminAction({ admin: ra, section: "remote-access", action: "session_start", details: `Connection #${parsed.data.connectionId} -> session #${sessionId}`, req });
    return NextResponse.json({ ok: true, data: { sessionId } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start session" }, { status: 400 });
  }
}

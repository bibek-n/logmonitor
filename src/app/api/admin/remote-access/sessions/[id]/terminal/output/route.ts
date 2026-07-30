import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getTerminalOutput } from "@/lib/remoteAccess/connectionService";

// Polled by TerminalWorkspaceClient every ~500ms - the confirmed HTTP-polling design (see the
// approved plan) instead of a WebSocket, matching this app's one existing precedent.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const since = Number(req.nextUrl.searchParams.get("since") ?? "0");
  const result = getTerminalOutput(Number(id), Number.isFinite(since) ? since : 0);
  if (!result) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true, data: result });
}

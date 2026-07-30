import { NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { getSessionSummary, getSessionTranscript } from "@/lib/remoteAccess/repository";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_session_logs_view");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const sessionId = Number(id);
  const summary = await getSessionSummary(sessionId);
  if (!summary) return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 });

  const transcript = await getSessionTranscript(sessionId);
  return NextResponse.json({ ok: true, data: { summary, transcript } });
}

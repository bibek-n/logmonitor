import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { sendTerminalInput } from "@/lib/remoteAccess/connectionService";

const inputSchema = z.object({ data: z.string().max(10_000) });

// The browser sends raw keystroke bytes here - never a "command to exec" string built
// server-side - which is what makes this safe against command injection by construction
// (there is no server-side shell-string concatenation anywhere in this path).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const sent = sendTerminalInput(Number(id), parsed.data.data);
  if (!sent) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

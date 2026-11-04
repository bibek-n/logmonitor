import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { sendVncKey } from "@/lib/remoteAccess/vncSessionService";

// `key` is the raw browser KeyboardEvent.key string - mapped to an X11 keysym server-side
// (keyToKeysym) so the client never needs its own copy of that table.
const keySchema = z.object({ key: z.string().min(1).max(32), down: z.boolean() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_vnc_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = keySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const sent = sendVncKey(Number(id), parsed.data.key, parsed.data.down);
  if (!sent) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

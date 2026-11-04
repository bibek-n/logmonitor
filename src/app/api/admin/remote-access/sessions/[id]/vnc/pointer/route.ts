import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { sendVncPointer } from "@/lib/remoteAccess/vncSessionService";

// x/y are in remote framebuffer pixel coordinates - the browser converts from canvas-local
// coordinates using the width/height returned by the start call, so this route never needs to
// know about scaling/DPI. buttons is the RFB button-mask bit pattern (bit0=left, bit1=middle,
// bit2=right, ...) - the client remaps from MouseEvent.buttons (bit0=left, bit1=right,
// bit2=middle) before sending, since the two bit orders put middle/right in opposite positions.
const pointerSchema = z.object({
  x: z.number().min(0).max(100_000),
  y: z.number().min(0).max(100_000),
  buttons: z.number().int().min(0).max(255),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_vnc_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = pointerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const sent = sendVncPointer(Number(id), parsed.data.x, parsed.data.y, parsed.data.buttons);
  if (!sent) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

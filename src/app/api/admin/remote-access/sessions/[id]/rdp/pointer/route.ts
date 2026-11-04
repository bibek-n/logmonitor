import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { sendRdpPointer } from "@/lib/remoteAccess/rdpSessionService";

// x/y are remote screen pixel coordinates; buttons is Guacamole's mouse button-mask (bit0=left,
// bit1=middle, bit2=right, bit3=scroll-up, bit4=scroll-down) - identical bit layout to RFB's
// PointerEvent mask, so the browser reuses the exact same MouseEvent.buttons remap used for VNC.
const pointerSchema = z.object({
  x: z.number().min(0).max(100_000),
  y: z.number().min(0).max(100_000),
  buttons: z.number().int().min(0).max(255),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_rdp_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = pointerSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const sent = sendRdpPointer(Number(id), parsed.data.x, parsed.data.y, parsed.data.buttons);
  if (!sent) return NextResponse.json({ ok: false, error: "Session not found or already ended" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

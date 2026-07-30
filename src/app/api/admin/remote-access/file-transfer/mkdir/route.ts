import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { mkdirRemote } from "@/lib/remoteAccess/connectionService";

const mkdirSchema = z.object({ connectionId: z.number().int().positive(), path: z.string().min(1).max(2000) });

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_file_transfer_use");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = mkdirSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "connectionId and path are required" }, { status: 400 });

  try {
    await mkdirRemote(parsed.data.connectionId, parsed.data.path);
    await logAdminAction({ admin: ra, section: "remote-access", action: "file_mkdir", details: parsed.data.path, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to create directory" }, { status: 400 });
  }
}

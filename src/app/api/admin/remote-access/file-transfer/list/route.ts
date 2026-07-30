import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { listRemoteDirectory } from "@/lib/remoteAccess/connectionService";

export async function GET(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_file_transfer_use");
  if (!isRemoteAccessSession(ra)) return ra;

  const connectionId = Number(req.nextUrl.searchParams.get("connectionId"));
  const path = req.nextUrl.searchParams.get("path") || "/";
  if (!connectionId) return NextResponse.json({ ok: false, error: "connectionId is required" }, { status: 400 });

  try {
    const entries = await listRemoteDirectory(connectionId, path);
    return NextResponse.json({ ok: true, data: entries });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to list directory" }, { status: 400 });
  }
}

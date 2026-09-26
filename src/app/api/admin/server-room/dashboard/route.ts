import { NextResponse } from "next/server";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { getDashboard } from "@/lib/serverRoom/service";
import { fail } from "@/lib/serverRoom/http";

export async function GET() {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  try {
    return NextResponse.json({ ok: true, data: await getDashboard() });
  } catch (err) {
    return fail(err, "server-room dashboard");
  }
}

import { NextResponse } from "next/server";
import { requireServerRoomPermission, isServerRoomSession } from "@/lib/requireServerRoomPermission";
import { getOptions } from "@/lib/serverRoom/service";
import { fail } from "@/lib/serverRoom/http";

// Staff / device / active-entry choices for the Server Room forms.
export async function GET() {
  const sr = await requireServerRoomPermission("sr_view");
  if (!isServerRoomSession(sr)) return sr;
  try {
    return NextResponse.json({ ok: true, data: await getOptions() });
  } catch (err) {
    return fail(err, "server-room options");
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getVapidPublicKey } from "@/lib/pushNotifications";

// Gated the same way as /api/admin/alerts/recent (any signed-in session) - push notifications
// are a per-viewer convenience available to everyone who sees the bell, not an admin-only tool.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const publicKey = await getVapidPublicKey();
  return NextResponse.json({ ok: true, publicKey });
}

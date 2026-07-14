import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getRecentAlerts } from "@/lib/alerts";

// Polled client-side by HeaderClient to pop a live toast for new alerts (USB
// insert/removal among them) without the admin having to refresh the page. Gated the
// same way the dashboard layout itself is - any signed-in session, not admin-only -
// since the notification bell it feeds is visible to every dashboard user, not just admins.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const alerts = await getRecentAlerts(20);
  return NextResponse.json({ ok: true, alerts });
}

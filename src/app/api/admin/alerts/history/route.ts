import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getAlertHistory } from "@/lib/alerts";

// Backs the Alert History page - gated the same way as /api/admin/alerts/recent (any
// signed-in session, not admin-only), since the page is reached from a sidebar link visible
// to every dashboard user, same as the notification bell it complements.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get("days")) || 30;
  const alerts = await getAlertHistory(days, 300);
  return NextResponse.json({ ok: true, alerts });
}

import { NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { getSummary } from "@/lib/securityUpdates/queries";

export async function GET() {
  const su = await requireSecurityUpdatesPermission("su_view");
  if (!isSecurityUpdatesSession(su)) return su;

  try {
    return NextResponse.json({ ok: true, data: await getSummary() });
  } catch (err) {
    console.error("security-updates summary failed", err);
    return NextResponse.json({ ok: false, error: "Failed to load summary" });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { listEvents } from "@/lib/intrusionDetection/fileIntegrity";

export async function GET(req: NextRequest) {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const limit = Number(req.nextUrl.searchParams.get("limit")) || 100;
  const events = await listEvents(Math.min(500, Math.max(1, limit)));
  return NextResponse.json({ ok: true, data: events });
}

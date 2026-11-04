import { NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { REPORT_SOURCES } from "@/lib/reportBuilder";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;
  return NextResponse.json({ ok: true, sources: REPORT_SOURCES });
}

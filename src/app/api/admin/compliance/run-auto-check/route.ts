import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { runAllAutoChecks } from "@/lib/compliance/autoChecks";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const results = await runAllAutoChecks();

  await logAdminAction({
    admin,
    section: "Compliance",
    action: "Ran auto-checks",
    details: `${results.length} check(s): ${results.map((r) => `${r.key}=${r.result.status}`).join(", ")}`,
    req,
  });

  return NextResponse.json({ ok: true, data: results });
}

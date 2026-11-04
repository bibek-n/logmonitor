import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getReportSource, runReportSource } from "@/lib/reportBuilder";

const bodySchema = z.object({
  sourceKey: z.string(),
  days: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const source = getReportSource(parsed.data.sourceKey);
  if (!source) {
    return NextResponse.json({ ok: false, error: "Unknown report source" }, { status: 400 });
  }

  try {
    const rows = await runReportSource(parsed.data.sourceKey, parsed.data.days ?? 30);
    return NextResponse.json({ ok: true, rows });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to run report" }, { status: 500 });
  }
}

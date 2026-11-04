import { NextRequest, NextResponse } from "next/server";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { listOffboardingEmployees } from "@/lib/offboarding/repository";

export async function GET(req: NextRequest) {
  const off = await requireOffboardingPermission("off_view");
  if (!isOffboardingSession(off)) return off;

  const search = req.nextUrl.searchParams.get("search") ?? undefined;
  const employees = await listOffboardingEmployees(search);
  return NextResponse.json({ ok: true, data: employees });
}

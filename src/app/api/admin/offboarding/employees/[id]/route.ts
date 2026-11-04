import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isOffboardingSession, requireOffboardingPermission } from "@/lib/requireOffboardingPermission";
import { getOffboardingEmployee, updateEmployeeMapping } from "@/lib/offboarding/repository";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await requireOffboardingPermission("off_view");
  if (!isOffboardingSession(off)) return off;

  const { id } = await params;
  const employee = await getOffboardingEmployee(Number(id));
  if (!employee) return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: employee });
}

const updateSchema = z.object({
  gitlabUsername: z.string().nullable().optional(),
  gitlabUserId: z.number().int().positive().nullable().optional(),
  glesysMailbox: z.string().nullable().optional(),
  agentQaUserId: z.string().nullable().optional(),
  teamworkEmail: z.string().nullable().optional(),
  logMonitorUsername: z.string().nullable().optional(),
  adUsername: z.string().nullable().optional(),
  offboardingDate: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const off = await requireOffboardingPermission("off_manage_mappings");
  if (!isOffboardingSession(off)) return off;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });

  const employee = await getOffboardingEmployee(Number(id));
  if (!employee) return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });

  await updateEmployeeMapping(Number(id), parsed.data);
  await logAdminAction({ admin: off, section: "offboarding", action: "update_mapping", details: `${employee.name} (#${id})` });

  return NextResponse.json({ ok: true });
}

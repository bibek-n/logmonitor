import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { runSctpDiagnostic } from "@/lib/remoteAccess/sctpDiagnostics";
import { listProtocolDiagnostics } from "@/lib/remoteAccess/repository";

const sctpCheckSchema = z.object({
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional().nullable(),
});

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_settings_manage");
  if (!isRemoteAccessSession(ra)) return ra;
  return NextResponse.json({ ok: true, data: await listProtocolDiagnostics() });
}

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_settings_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = sctpCheckSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Host is required" }, { status: 400 });

  const result = await runSctpDiagnostic(parsed.data.host, parsed.data.port ?? null, ra.userId);
  return NextResponse.json({ ok: true, data: result });
}

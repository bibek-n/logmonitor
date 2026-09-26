import { NextRequest, NextResponse } from "next/server";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { listDevices } from "@/lib/securityUpdates/queries";

const OS_VALUES = ["windows", "linux", "darwin"];
const TYPE_VALUES = ["Workstation", "Server"];
const STATUS_VALUES = ["needs", "failed", "reboot", "clean", "never"];

export async function GET(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_view");
  if (!isSecurityUpdatesSession(su)) return su;

  const p = req.nextUrl.searchParams;
  const os = p.get("os") ?? "";
  const type = p.get("type") ?? "";
  const status = p.get("status") ?? "";
  const page = Math.max(1, Number(p.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(p.get("pageSize")) || 25));

  try {
    const result = await listDevices({
      os: OS_VALUES.includes(os) ? os : undefined,
      type: TYPE_VALUES.includes(type) ? type : undefined,
      status: STATUS_VALUES.includes(status) ? status : undefined,
      q: (p.get("q") ?? "").trim().slice(0, 100) || undefined,
      page,
      pageSize,
    });
    return NextResponse.json({ ok: true, data: result.rows, total: result.total, page, pageSize });
  } catch (err) {
    console.error("security-updates devices failed", err);
    return NextResponse.json({ ok: false, error: "Failed to load devices" });
  }
}

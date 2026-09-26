import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSecurityUpdatesPermission, isSecurityUpdatesSession } from "@/lib/requireSecurityUpdatesPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { InstallError, requestInstall, requestSafeInstalls } from "@/lib/securityUpdates/installs";

// Approved installs. Two shapes:
//  - { deviceId, updateKeys, confirmDisruptive? }  install chosen updates on ONE device. Disruptive updates (OS, kernel,
//    firmware, critical, restart-requiring) are rejected with 409 + the list unless confirmDisruptive is true.
//  - { deviceIds, safeOnly: true }                 "Update" on several devices: only non-disruptive updates, never more.
const bodySchema = z.union([
  z.object({ deviceId: z.string().min(1).max(40), updateKeys: z.array(z.string().min(1).max(300)).min(1).max(200), confirmDisruptive: z.boolean().optional() }),
  z.object({ deviceIds: z.array(z.string().min(1).max(40)).min(1).max(200), safeOnly: z.literal(true) }),
]);

export async function POST(req: NextRequest) {
  const su = await requireSecurityUpdatesPermission("su_install");
  if (!isSecurityUpdatesSession(su)) return su;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Choose the updates to install." }, { status: 400 });
  const actor = { userId: su.userId, username: su.username };

  try {
    if ("safeOnly" in parsed.data) {
      const r = await requestSafeInstalls(parsed.data.deviceIds, actor);
      await logAdminAction({ admin: su, section: "security-updates", action: "install_safe", details: `queued ${r.queued.length}, skipped ${r.skipped.length}`, req });
      return NextResponse.json({ ok: true, ...r });
    }
    const r = await requestInstall({ deviceId: parsed.data.deviceId, updateKeys: parsed.data.updateKeys, confirmDisruptive: parsed.data.confirmDisruptive === true, actor });
    await logAdminAction({
      admin: su,
      section: "security-updates",
      action: r.disruptiveCount > 0 ? "install_disruptive_confirmed" : "install",
      details: `device ${parsed.data.deviceId}: ${r.count} update(s), ${r.disruptiveCount} disruptive, request #${r.requestId}`,
      req,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof InstallError) {
      return NextResponse.json({ ok: false, error: err.message, ...(err.details as object | undefined) }, { status: (err.details as { confirmationRequired?: boolean } | undefined)?.confirmationRequired ? 200 : err.status });
    }
    console.error("security-updates install failed", err);
    return NextResponse.json({ ok: false, error: "Could not queue the install" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { runRemoteCommand } from "@/lib/remoteAccess/connectionService";
import { getInventoryDevice } from "@/lib/remoteAccess/repository";

const confirmSchema = z.object({ confirm: z.literal(true) });

// Server-side confirmation check, not just client-side - a destructive action this severe gets
// defense in depth. Only reachable when the inventory device is linked to a real
// RemoteConnection (SSH) - there is no "restart" capability for a device with nothing to
// connect to.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_device_restart");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  if (!confirmSchema.safeParse(body).success) {
    return NextResponse.json({ ok: false, error: "This action requires explicit confirmation." }, { status: 400 });
  }

  const { id } = await params;
  const device = await getInventoryDevice(Number(id));
  if (!device) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  if (!device.linkedConnectionId) {
    return NextResponse.json({ ok: false, error: "This device has no linked SSH connection to restart it through." }, { status: 400 });
  }

  const command = device.operatingSystem === "windows" ? "shutdown /r /t 0" : "sudo -n reboot";
  try {
    const result = await runRemoteCommand(device.linkedConnectionId, command);
    await writeAuditEvent({ eventType: "DeviceRestarted", userId: ra.userId, username: ra.username, connectionId: device.linkedConnectionId, action: device.deviceName, result: result.code === 0 ? "Success" : "Failure", failureReason: result.code === 0 ? null : result.stderr.slice(0, 500) });
    await logAdminAction({ admin: ra, section: "remote-access", action: "device_restart", details: device.deviceName, req });
    return NextResponse.json({ ok: true, data: { exitCode: result.code } });
  } catch (err) {
    await writeAuditEvent({ eventType: "DeviceRestarted", userId: ra.userId, username: ra.username, connectionId: device.linkedConnectionId, action: device.deviceName, result: "Failure", failureReason: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Restart failed" }, { status: 400 });
  }
}

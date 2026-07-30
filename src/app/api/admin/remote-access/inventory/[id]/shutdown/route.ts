import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { runRemoteCommand } from "@/lib/remoteAccess/connectionService";
import { getInventoryDevice } from "@/lib/remoteAccess/repository";

const confirmSchema = z.object({ confirm: z.literal(true) });

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_device_shutdown");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  if (!confirmSchema.safeParse(body).success) {
    return NextResponse.json({ ok: false, error: "This action requires explicit confirmation." }, { status: 400 });
  }

  const { id } = await params;
  const device = await getInventoryDevice(Number(id));
  if (!device) return NextResponse.json({ ok: false, error: "Device not found" }, { status: 404 });
  if (!device.linkedConnectionId) {
    return NextResponse.json({ ok: false, error: "This device has no linked SSH connection to shut it down through." }, { status: 400 });
  }

  const command = device.operatingSystem === "windows" ? "shutdown /s /t 0" : "sudo -n shutdown -h now";
  try {
    const result = await runRemoteCommand(device.linkedConnectionId, command);
    await writeAuditEvent({ eventType: "DeviceShutDown", userId: ra.userId, username: ra.username, connectionId: device.linkedConnectionId, action: device.deviceName, result: result.code === 0 ? "Success" : "Failure", failureReason: result.code === 0 ? null : result.stderr.slice(0, 500) });
    await logAdminAction({ admin: ra, section: "remote-access", action: "device_shutdown", details: device.deviceName, req });
    return NextResponse.json({ ok: true, data: { exitCode: result.code } });
  } catch (err) {
    await writeAuditEvent({ eventType: "DeviceShutDown", userId: ra.userId, username: ra.username, connectionId: device.linkedConnectionId, action: device.deviceName, result: "Failure", failureReason: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Shutdown failed" }, { status: 400 });
  }
}

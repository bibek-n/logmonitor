import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { openDockerContainerShell, openKubernetesPodShell } from "@/lib/remoteAccess/containerService";

const shellSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("docker"), containerId: z.string().trim().min(1).max(128) }),
  z.object({ type: z.literal("kubernetes"), namespace: z.string().trim().min(1).max(63), podName: z.string().trim().min(1).max(128) }),
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = shellSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });

  try {
    const sessionId =
      parsed.data.type === "docker"
        ? await openDockerContainerShell(Number(id), parsed.data.containerId, ra.userId, ra.username)
        : await openKubernetesPodShell(Number(id), parsed.data.namespace, parsed.data.podName, ra.userId, ra.username);

    await logAdminAction({
      admin: ra,
      section: "remote-access",
      action: "container_shell_open",
      details: parsed.data.type === "docker" ? `docker:${parsed.data.containerId}` : `k8s:${parsed.data.namespace}/${parsed.data.podName}`,
      req,
    });
    return NextResponse.json({ ok: true, data: { sessionId } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to open shell" }, { status: 400 });
  }
}

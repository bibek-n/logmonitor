import { NextRequest, NextResponse } from "next/server";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { listDockerContainers, listKubernetesPods } from "@/lib/remoteAccess/containerService";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ra = await requireRemoteAccessPermission("ra_commands_execute");
  if (!isRemoteAccessSession(ra)) return ra;

  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type") === "kubernetes" ? "kubernetes" : "docker";
  const namespace = req.nextUrl.searchParams.get("namespace") || "default";

  try {
    if (type === "kubernetes") {
      const pods = await listKubernetesPods(Number(id), namespace);
      return NextResponse.json({ ok: true, data: { type, pods } });
    }
    const containers = await listDockerContainers(Number(id));
    return NextResponse.json({ ok: true, data: { type, containers } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to list containers" }, { status: 400 });
  }
}

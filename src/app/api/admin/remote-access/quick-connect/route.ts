import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { quickConnectSchema } from "@/lib/remoteAccess/schema";
import { startTerminalSession } from "@/lib/remoteAccess/connectionService";
import { getSshPrivateKey } from "@/lib/remoteAccess/repository";
import { createConnection } from "@/lib/remoteAccess/repository";

// Quick Connect never persists a password unless saveConnection is explicitly ticked - and even
// then, only the CONNECTION metadata is saved (as a normal RemoteConnections row an admin can
// later attach a real vault credential to); the raw password typed into this form is used once
// to dial and is never written to RemoteCredentials on its own.
export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_ssh_start");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = quickConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid quick connect request" }, { status: 400 });
  }
  const p = parsed.data;

  if (p.protocol !== "SSH") {
    return NextResponse.json({ ok: false, error: `Quick Connect for ${p.protocol} is not available yet (Phase 2).` }, { status: 400 });
  }

  let privateKey: string | undefined;
  if (p.sshKeyId) {
    const key = await getSshPrivateKey(p.sshKeyId);
    if (key) privateKey = key.privateKeyPem;
  }

  try {
    const sessionId = await startTerminalSession({
      connectionId: null,
      adHoc: {
        hostname: (p.hostname || p.ipAddress) as string,
        port: p.port,
        username: p.username || "",
        password: p.password || undefined,
        privateKey,
      },
      userId: ra.userId,
      username: ra.username,
    });

    let savedConnectionId: number | null = null;
    if (p.saveConnection) {
      savedConnectionId = await createConnection(
        {
          name: `${p.username ?? "quick"}@${p.hostname || p.ipAddress}`,
          hostname: p.hostname ?? null,
          ipAddress: p.ipAddress ?? null,
          port: p.port,
          protocol: "SSH",
          username: p.username ?? null,
          domain: null,
          credentialId: null,
          sshKeyId: p.sshKeyId ?? null,
          remoteDirectory: null,
          operatingSystem: null,
          deviceType: null,
          environment: "Production",
          customer: null,
          location: null,
          groupId: null,
          tags: [],
          notes: "Saved from Quick Connect",
          isFavorite: false,
          connectionTimeoutSeconds: p.connectionTimeoutSeconds,
          keepaliveIntervalSeconds: 30,
          autoReconnect: false,
          jumpHostConnectionId: p.jumpHostConnectionId ?? null,
          preConnectCommand: null,
          postConnectCommand: null,
          isShared: true,
        },
        ra.userId
      );
    }

    await logAdminAction({ admin: ra, section: "remote-access", action: "quick_connect", details: `${p.username ?? ""}@${p.hostname || p.ipAddress}`, req });
    return NextResponse.json({ ok: true, data: { sessionId, savedConnectionId } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, { status: 400 });
  }
}

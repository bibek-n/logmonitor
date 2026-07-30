import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { generateSshKeySchema, importSshKeySchema } from "@/lib/remoteAccess/schema";
import { createSshKeyRecord, listSshKeys } from "@/lib/remoteAccess/repository";
import { generateSshKeyPair, looksLikePrivateKey } from "@/lib/remoteAccess/sshKeygen";

export async function GET() {
  const ra = await requireRemoteAccessPermission("ra_ssh_keys_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  return NextResponse.json({ ok: true, data: await listSshKeys() });
}

const requestSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("generate") }).merge(generateSshKeySchema),
  z.object({ mode: z.literal("import") }).merge(importSshKeySchema),
]);

export async function POST(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_ssh_keys_manage");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid SSH key request" }, { status: 400 });
  }

  try {
    if (parsed.data.mode === "generate") {
      const generated = await generateSshKeyPair(parsed.data.keyType, parsed.data.passphrase);
      const id = await createSshKeyRecord({
        name: parsed.data.name,
        keyType: parsed.data.keyType,
        publicKey: generated.publicKey,
        privateKeyPem: generated.privateKeyPem,
        fingerprint: generated.fingerprint,
        passphraseCredentialId: null,
        userId: ra.userId,
      });
      await logAdminAction({ admin: ra, section: "remote-access", action: "ssh_key_generate", details: `${parsed.data.name} (${parsed.data.keyType})`, req });
      return NextResponse.json({ ok: true, data: { id, publicKey: generated.publicKey, fingerprint: generated.fingerprint } });
    }

    if (!looksLikePrivateKey(parsed.data.privateKey)) {
      return NextResponse.json({ ok: false, error: "That doesn't look like a private key (expected a -----BEGIN ... PRIVATE KEY----- block)." }, { status: 400 });
    }
    // Public key is derived server-side would require parsing the private key's format - for
    // Phase 1's import flow, the caller is expected to also know/paste the matching public key
    // separately when adding it to a remote host's authorized_keys; here we store a placeholder
    // fingerprint derived from the private key's own hash so at least a stable identifier exists.
    const crypto = await import("crypto");
    const fingerprint = `SHA256:${crypto.createHash("sha256").update(parsed.data.privateKey).digest("base64").replace(/=+$/, "")}`;
    const id = await createSshKeyRecord({
      name: parsed.data.name,
      keyType: "Rsa",
      publicKey: "(not derived - import provided a private key only)",
      privateKeyPem: parsed.data.privateKey,
      fingerprint,
      passphraseCredentialId: null,
      userId: ra.userId,
    });
    await logAdminAction({ admin: ra, section: "remote-access", action: "ssh_key_import", details: parsed.data.name, req });
    return NextResponse.json({ ok: true, data: { id, fingerprint } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "SSH key operation failed" }, { status: 400 });
  }
}


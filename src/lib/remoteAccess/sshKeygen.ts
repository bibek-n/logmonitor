import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { generateFingerprint } from "./crypto";

const execFileAsync = promisify(execFile);

// Shells out to the system `ssh-keygen` binary - a single hardcoded executable name with a
// fixed, non-shell argv array (execFile, never a shell string), matching the "apply strict
// allowlists for local executable calls" security requirement. This produces real, correctly-
// formatted OpenSSH keys (wire-format public key, OpenSSH/PEM private key) without hand-rolling
// binary key-format encoding, which is error-prone for RSA in particular. Windows Server 2019+
// ships ssh-keygen.exe as part of the optional OpenSSH Client feature; if it's not installed,
// this throws a clear error rather than silently producing something malformed.
export async function generateSshKeyPair(keyType: "Ed25519" | "Rsa", passphrase?: string | null): Promise<{ publicKey: string; privateKeyPem: string; fingerprint: string }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "logmonitor-sshkeygen-"));
  const keyPath = path.join(tmpDir, "key");
  try {
    const args = ["-t", keyType === "Ed25519" ? "ed25519" : "rsa", "-f", keyPath, "-N", passphrase ?? "", "-C", "", "-q"];
    if (keyType === "Rsa") args.push("-b", "4096");

    await execFileAsync("ssh-keygen", args);

    const [privateKeyPem, publicKey] = await Promise.all([fs.readFile(keyPath, "utf8"), fs.readFile(`${keyPath}.pub`, "utf8")]);
    const trimmedPublicKey = publicKey.trim();
    return { publicKey: trimmedPublicKey, privateKeyPem, fingerprint: generateFingerprint(trimmedPublicKey) };
  } catch (err) {
    throw new Error(
      `SSH key generation failed - confirm ssh-keygen (OpenSSH Client) is installed on this server: ${err instanceof Error ? err.message : String(err)}`
    );
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export function parseImportedPublicKeyFingerprint(publicKey: string): string {
  return generateFingerprint(publicKey);
}

// Cheap structural validation before ever storing an imported private key - real parsing (and
// the only place a wrong passphrase would actually surface) happens when node-ssh/ssh2 uses it
// to dial a real connection.
export function looksLikePrivateKey(value: string): boolean {
  return /-----BEGIN (OPENSSH PRIVATE KEY|RSA PRIVATE KEY|PRIVATE KEY|EC PRIVATE KEY)-----/.test(value);
}

export function randomToken(bytes: number = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Authenticator-app (TOTP, RFC 6238) support — enroll by scanning a QR code with Google
// Authenticator or Microsoft Authenticator, then use the app's 6-digit code instead of the
// emailed OTP code (see authOptions.ts / request-otp / verify-otp). SHA1/6-digits/30s are
// deliberately hardcoded rather than configurable: they're the one combination every
// authenticator app supports out of the box — anything else (SHA256, 8 digits, other periods)
// is inconsistently supported and would silently break enrollment for some apps.

const ISSUER = "LogMonitor";
const ALGORITHM = "SHA1";
const DIGITS = 6;
const PERIOD = 30;
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids transcription mistakes

export { RECOVERY_CODE_COUNT };

export function generateTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

function buildTotp(secretBase32: string, username: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export function buildOtpauthUrl(secretBase32: string, username: string): string {
  return buildTotp(secretBase32, username).toString();
}

export async function generateQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}

// ±1 step (±30s) tolerates minor clock drift between the server and the phone, the standard
// recommendation for TOTP verification.
export function validateTotpCode(secretBase32: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const totp = buildTotp(secretBase32, "verify");
  return totp.validate({ token: code, window: 1 }) !== null;
}

// AES-256-GCM, key derived from the NextAuth secret this app already requires — avoids
// introducing a second secret to configure/deploy. Stored as "iv:authTag:ciphertext" (hex).
const ENCRYPTION_ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET must be set to encrypt/decrypt TOTP secrets.");
  return crypto.scryptSync(secret, "totp-secret", 32);
}

export function encryptTotpSecret(secretBase32: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(stored: string): string {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Malformed encrypted TOTP secret.");
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

function randomRecoveryCode(): string {
  const chars = Array.from({ length: 8 }, () => RECOVERY_CODE_ALPHABET[crypto.randomInt(RECOVERY_CODE_ALPHABET.length)]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// Plaintext codes are returned once for the caller to show the user and are never stored —
// only their bcrypt hashes are persisted (same hashing this app already uses for
// PendingOtpCodeHash), so a database compromise alone can't be used to log in.
export async function generateRecoveryCodes(): Promise<{ plaintext: string[]; hashes: string[] }> {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  const hashes = await Promise.all(plaintext.map((code) => bcrypt.hash(code, 10)));
  return { plaintext, hashes };
}

export function normalizeRecoveryCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

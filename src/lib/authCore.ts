import bcrypt from "bcryptjs";
import { getDb, sql } from "./db";

export interface AuthCoreUser {
  Id: number;
  Username: string;
  Role: string;
  Email: string | null;
  PendingOtpCodeHash: string | null;
  PendingOtpExpiresAt: Date | null;
  PendingOtpAttempts: number;
  TotpEnabled: boolean;
  TotpSecretEncrypted: string | null;
}

export type ValidateResult = { ok: true; user: AuthCoreUser } | { ok: false; reason: string };

// Shared by src/lib/authOptions.ts and the /api/auth/request-otp + /api/auth/verify-otp
// routes so the password check never lives in more than one place.
export async function validateUserCredentials(username: string, password: string): Promise<ValidateResult> {
  const db = await getDb();
  const result = await db
    .request()
    .input("username", sql.NVarChar, username)
    .query<AuthCoreUser & { PasswordHash: string; IsActive: boolean }>(
      `SELECT Id, Username, PasswordHash, Role, IsActive, Email, PendingOtpCodeHash, PendingOtpExpiresAt,
        PendingOtpAttempts, TotpEnabled, TotpSecretEncrypted
      FROM Users WHERE Username = @username`
    );

  const user = result.recordset[0];
  if (!user) return { ok: false, reason: "Unknown username" };
  if (user.IsActive === false) return { ok: false, reason: "Account deactivated" };

  const valid = await bcrypt.compare(password, user.PasswordHash);
  if (!valid) return { ok: false, reason: "Incorrect password" };

  return { ok: true, user };
}

export interface OtpCheckUser {
  Id: number;
  IsActive: boolean;
  PendingOtpCodeHash: string | null;
  PendingOtpExpiresAt: Date | null;
  PendingOtpAttempts: number;
  TotpEnabled: boolean;
  TotpSecretEncrypted: string | null;
}

// Used by /api/auth/verify-otp, the read-only "dry check" that gives the login form a nice
// inline error before the real signIn() call. It deliberately skips the password bcrypt
// compare (unlike validateUserCredentials above) — the password was already confirmed once
// by /api/auth/request-otp to issue this code, and it's confirmed again by authorize() in
// authOptions.ts before any session is actually issued, so re-hashing it a third time here
// only added latency to every OTP submission without adding any real security: this route
// never grants a session, it only reports whether the OTP itself looks right.
export async function getUserForOtpCheck(username: string): Promise<OtpCheckUser | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("username", sql.NVarChar, username)
    .query<OtpCheckUser>(
      `SELECT Id, IsActive, PendingOtpCodeHash, PendingOtpExpiresAt, PendingOtpAttempts, TotpEnabled, TotpSecretEncrypted
      FROM Users WHERE Username = @username`
    );
  return result.recordset[0] ?? null;
}

// Used by the passkey (WebAuthn) sign-in path, which authenticates via a stored credential
// rather than a username/password pair, so it needs to look the account up by id instead.
export async function getUserById(id: number): Promise<{ Id: number; Username: string; Role: string; IsActive: boolean; Email: string | null } | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ Id: number; Username: string; Role: string; IsActive: boolean; Email: string | null }>(
      "SELECT Id, Username, Role, IsActive, Email FROM Users WHERE Id = @id"
    );
  return result.recordset[0] ?? null;
}

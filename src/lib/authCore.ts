import bcrypt from "bcryptjs";
import crypto from "crypto";
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

const COMMIT_TOKEN_TTL_MINUTES = 3;

function hashCommitToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Issued by /api/auth/request-otp immediately after validateUserCredentials's bcrypt password
// check succeeds, and returned to the caller's own browser in that response. authorize() in
// authOptions.ts can then trust a matching, unexpired, single-use token as proof the password
// was already correctly verified moments ago — skipping a second, identically expensive bcrypt
// compare on the hot "user just entered their OTP/TOTP code" path. This is safe specifically
// because the raw token is a fresh, unguessable secret disclosed only to whoever already had
// the correct password (nothing about "was this user's password ever verified recently" is
// trusted on its own — only possession of this exact bearer token is): a party who never
// called request-otp themselves — e.g. someone who obtained a valid OTP/TOTP code some other
// way but doesn't know the password — never sees this token and gets no shortcut.
export async function issueCommitToken(userId: number): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, userId)
    .input("hash", sql.VarChar, hashCommitToken(token))
    .query(`UPDATE Users SET CommitTokenHash = @hash, CommitTokenExpiresAt = DATEADD(MINUTE, ${COMMIT_TOKEN_TTL_MINUTES}, SYSUTCDATETIME()) WHERE Id = @id`);
  return token;
}

export interface AuthCommitUser extends AuthCoreUser {
  IsActive: boolean;
}

// Cheap, no-bcrypt user lookup for authorize()'s commit step — paired with a commitToken
// check (see issueCommitToken above). Whenever there's no valid token, authorize() falls back
// to the full validateUserCredentials() bcrypt path below, so nothing here can grant a session
// on its own; it only lets the common case skip redundant work.
export async function getUserForAuthCommit(username: string): Promise<(AuthCommitUser & { CommitTokenHash: string | null; CommitTokenExpiresAt: Date | null }) | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("username", sql.NVarChar, username)
    .query<AuthCommitUser & { CommitTokenHash: string | null; CommitTokenExpiresAt: Date | null }>(
      `SELECT Id, Username, Role, IsActive, Email, PendingOtpCodeHash, PendingOtpExpiresAt,
        PendingOtpAttempts, TotpEnabled, TotpSecretEncrypted, CommitTokenHash, CommitTokenExpiresAt
      FROM Users WHERE Username = @username`
    );
  return result.recordset[0] ?? null;
}

// Verifies a caller-supplied commitToken against the stored hash with a constant-time
// comparison (the hash itself is effectively a bearer secret). Returns true only when the
// hash matches AND the token hasn't expired — callers must consume it via consumeCommitToken
// right after a successful check so it can never cover a second sign-in attempt.
export function commitTokenMatches(user: { CommitTokenHash: string | null; CommitTokenExpiresAt: Date | null }, token: string | undefined): boolean {
  if (!token || !user.CommitTokenHash || !user.CommitTokenExpiresAt) return false;
  if (new Date(user.CommitTokenExpiresAt).getTime() < Date.now()) return false;
  return timingSafeEqualHex(hashCommitToken(token), user.CommitTokenHash);
}

export async function consumeCommitToken(userId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, userId).query("UPDATE Users SET CommitTokenHash = NULL, CommitTokenExpiresAt = NULL WHERE Id = @id");
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

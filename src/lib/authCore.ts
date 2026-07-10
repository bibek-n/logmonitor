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
      "SELECT Id, Username, PasswordHash, Role, IsActive, Email, PendingOtpCodeHash, PendingOtpExpiresAt, PendingOtpAttempts FROM Users WHERE Username = @username"
    );

  const user = result.recordset[0];
  if (!user) return { ok: false, reason: "Unknown username" };
  if (user.IsActive === false) return { ok: false, reason: "Account deactivated" };

  const valid = await bcrypt.compare(password, user.PasswordHash);
  if (!valid) return { ok: false, reason: "Incorrect password" };

  return { ok: true, user };
}

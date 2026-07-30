import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { getDb, sql } from "../src/lib/db";

// Ephemeral, one-shot admin session for a full-app smoke-test sweep. Mirrors the
// established pattern in scripts/migrate-qa-e2e-test-user.ts + scripts/_mint-e2e-jwt.ts
// (deleted after use there too): create a throwaway account with a password nobody knows,
// mint a NextAuth session JWT directly, never touch the real login flow. Deleted by
// scripts/_smoke-cleanup.ts immediately after the sweep finishes.
const SMOKE_USERNAME = "smoke-test-bot-" + Date.now();

async function main() {
  const db = await getDb();

  const roleRow = await db.request().query<{ Role: string }>(
    "SELECT TOP 1 Role FROM Users WHERE Role IN ('Admin','Super Admin','SuperAdmin') ORDER BY CASE Role WHEN 'Super Admin' THEN 0 WHEN 'SuperAdmin' THEN 0 ELSE 1 END"
  );
  if (roleRow.recordset.length === 0) {
    console.error("NO_ADMIN_ROLE_FOUND");
    process.exit(1);
  }
  const role = roleRow.recordset[0].Role;

  const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
  const result = await db
    .request()
    .input("username", sql.NVarChar, SMOKE_USERNAME)
    .input("passwordHash", sql.NVarChar, randomPasswordHash)
    .input("role", sql.NVarChar, role)
    .query<{ Id: number }>("INSERT INTO Users (Username, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@username, @passwordHash, @role)");
  const userId = result.recordset[0].Id;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NO_NEXTAUTH_SECRET");
    process.exit(1);
  }

  const token = await encode({
    token: {
      sub: String(userId),
      name: SMOKE_USERNAME,
      role,
      userId: String(userId),
    },
    secret,
    maxAge: 2 * 60 * 60,
  });

  const useSecureCookies = (process.env.NEXTAUTH_URL || "").startsWith("https://");
  const cookieName = useSecureCookies ? "__Secure-next-auth.session-token" : "next-auth.session-token";

  console.log(JSON.stringify({ userId, username: SMOKE_USERNAME, role, cookieName, token }));
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE_MINT_ERROR", err);
  process.exit(1);
});

import "dotenv/config";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getDb, sql } from "../src/lib/db";

// Seeds one dedicated, EPHEMERAL account for a single Playwright E2E run
// (e2e/qa-critical-workflow.spec.ts) — created immediately before the run and deleted
// immediately after (see e2e/README.md), never left standing. Its password hash is a random
// value nobody knows and OTP/passkey login is never exercised for it; E2E auth instead mints
// a NextAuth session JWT directly (scripts/_mint-e2e-jwt.ts, also deleted right after use) and
// injects it as a browser cookie. Role is 'QA Manager' (an existing seeded role, not 'Admin')
// so this account is scoped to QA data only via the normal RolePermissions grant path — it
// cannot reach anything outside /api/admin/qa/**, even for the short window it exists.
export const QA_E2E_TEST_USERNAME = "qa-e2e-test-bot";
const QA_E2E_TEST_ROLE = "QA Manager";

async function main() {
  const db = await getDb();
  const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

  const existing = await db.request().input("username", sql.NVarChar, QA_E2E_TEST_USERNAME).query<{ Id: number }>(
    "SELECT Id FROM Users WHERE Username = @username"
  );

  if (existing.recordset.length > 0) {
    console.log(`E2E test user '${QA_E2E_TEST_USERNAME}' already exists (Id ${existing.recordset[0].Id}).`);
  } else {
    const result = await db
      .request()
      .input("username", sql.NVarChar, QA_E2E_TEST_USERNAME)
      .input("passwordHash", sql.NVarChar, randomPasswordHash)
      .input("role", sql.NVarChar, QA_E2E_TEST_ROLE)
      .query<{ Id: number }>(
        "INSERT INTO Users (Username, PasswordHash, Role) OUTPUT INSERTED.Id VALUES (@username, @passwordHash, @role)"
      );
    console.log(`Created E2E test user '${QA_E2E_TEST_USERNAME}' (Id ${result.recordset[0].Id}), role '${QA_E2E_TEST_ROLE}'.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

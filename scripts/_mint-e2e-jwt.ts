import "dotenv/config";
import fs from "fs";
import path from "path";
import { encode } from "next-auth/jwt";
import { getDb, sql } from "../src/lib/db";
import { QA_E2E_TEST_USERNAME } from "./migrate-qa-e2e-test-user";

// One-off, never committed: mints a valid NextAuth session JWT for the seeded E2E test user
// and prints ONLY the signed token to stdout (never the secret itself). The Playwright suite
// takes this token and sets it as the `next-auth.session-token` cookie directly, so the E2E
// run exercises real authenticated pages/APIs without needing to automate the OTP email/SMS
// delivery step of the actual login flow.
async function main() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("NEXTAUTH_SECRET is not set in this environment.");
    process.exit(1);
  }

  const db = await getDb();
  const userRow = await db.request().input("username", sql.NVarChar, QA_E2E_TEST_USERNAME).query<{ Id: number; Username: string; Role: string }>(
    "SELECT Id, Username, Role FROM Users WHERE Username = @username"
  );
  const user = userRow.recordset[0];
  if (!user) {
    console.error(`E2E test user '${QA_E2E_TEST_USERNAME}' not found — run migrate:qa-e2e-test-user first.`);
    process.exit(1);
  }

  const token = await encode({
    secret,
    token: {
      name: user.Username,
      role: user.Role,
      userId: String(user.Id),
      sub: String(user.Id),
    },
  });

  // Written to a file (never printed to stdout/console) so the token never lands in any
  // terminal transcript or log — this script's own caller reads the file directly, then
  // deletes it, in the same step it deletes this script.
  const outPath = path.join(__dirname, "_e2e-token.txt");
  fs.writeFileSync(outPath, token, "utf8");
  console.log(`Token written to ${outPath} (${token.length} chars). Not printed here.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { getDb } from "../src/lib/db";

// Lets authorize()'s commit step in authOptions.ts skip re-running the expensive bcrypt
// password compare it currently repeats every login (the password was already bcrypt-checked
// once by /api/auth/request-otp moments earlier). See src/lib/authCore.ts's issueCommitToken/
// getUserForAuthCommit/consumeCommitToken for the full design: request-otp issues a random,
// single-use, short-lived token (hashed here, raw value only ever sent to the caller's own
// browser in the request-otp response) instead of just flagging "password verified" on the
// row, so a party who never went through request-otp themselves (and therefore never saw the
// token) gets no shortcut even if they know a valid OTP/TOTP code.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CommitTokenHash')
    ALTER TABLE Users ADD CommitTokenHash NVARCHAR(64) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'CommitTokenExpiresAt')
    ALTER TABLE Users ADD CommitTokenExpiresAt DATETIME2 NULL
  `;

  console.log("Users.CommitTokenHash / CommitTokenExpiresAt columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

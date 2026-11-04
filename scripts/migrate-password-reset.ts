import "dotenv/config";
import { getDb } from "../src/lib/db";

// Self-service "Forgot password?" flow: adds a hashed, time-limited, single-use reset token
// pair on Users, mirroring the existing CommitTokenHash/CommitTokenExpiresAt pattern used by
// the OTP sign-in commit step (src/lib/authCore.ts) rather than inventing a new convention.
// Also seeds the password_reset NotificationTemplates row, same as scripts/migrate-login-otp.ts
// did for login_otp_code/login_success, so the email text is editable from Company Settings >
// Notifications like every other system email.

const POLICY_TEXT = `A reminder of our dashboard usage policy:
- Never share your login credentials or one-time codes with anyone.
- Always log out when using a shared or public computer.
- Report any suspicious account activity to your administrator immediately.
- Data accessed through this dashboard is confidential — do not export or share it outside authorized use.`;

const PASSWORD_RESET_BODY = `We received a request to reset the password for your Tulips Unified Admin Center account ({{username}}).

Reset your password: {{resetUrl}}

This link expires in {{expiryMinutes}} minutes and can only be used once. If you didn't request this, you can safely ignore this email — your password won't be changed.

${POLICY_TEXT}`;

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordResetTokenHash')
    ALTER TABLE Users ADD PasswordResetTokenHash VARCHAR(64) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordResetTokenExpiresAt')
    ALTER TABLE Users ADD PasswordResetTokenExpiresAt DATETIME2 NULL
  `;

  const existingResult = await db.query<{ Key: string }>`SELECT [Key] FROM NotificationTemplates`;
  const existingKeys = new Set(existingResult.recordset.map((r) => r.Key));

  if (!existingKeys.has("password_reset")) {
    await db
      .request()
      .input("subject", "Reset your Tulips Unified Admin Center password")
      .input("body", PASSWORD_RESET_BODY)
      .query("INSERT INTO NotificationTemplates ([Key], Subject, Body, IsSystem) VALUES ('password_reset', @subject, @body, 1)");
    console.log("Seeded NotificationTemplates row: password_reset");
  }

  console.log("Password reset schema ready (PasswordResetTokenHash/PasswordResetTokenExpiresAt on Users).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

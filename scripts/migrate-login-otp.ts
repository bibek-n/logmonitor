import "dotenv/config";
import { getDb } from "../src/lib/db";

async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, definition: string) {
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${definition}
  `);
}

const POLICY_TEXT = `A reminder of our dashboard usage policy:
- Never share your login credentials or one-time codes with anyone.
- Always log out when using a shared or public computer.
- Report any suspicious account activity to your administrator immediately.
- Data accessed through this dashboard is confidential — do not export or share it outside authorized use.`;

const LOGIN_OTP_CODE_BODY = `Your Tulips Unified Admin Center login code is: {{code}}

This code expires in {{expiryMinutes}} minutes. If you didn't try to sign in, you can ignore this email.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}`;

const LOGIN_SUCCESS_BODY = `Hi {{name}},

You successfully signed in to Tulips Unified Admin Center on {{date}} from IP {{ip}}.

Dashboard: {{dashboardUrl}}

${POLICY_TEXT}

If this wasn't you, contact your administrator right away.`;

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Users", "PendingOtpCodeHash", "NVARCHAR(255) NULL");
  await addColumnIfMissing(db, "Users", "PendingOtpExpiresAt", "DATETIME2 NULL");
  await addColumnIfMissing(db, "Users", "PendingOtpAttempts", "INT NOT NULL DEFAULT 0");

  const existingResult = await db.query<{ Key: string }>`SELECT [Key] FROM NotificationTemplates`;
  const existingKeys = new Set(existingResult.recordset.map((r) => r.Key));

  if (!existingKeys.has("login_otp_code")) {
    await db
      .request()
      .input("subject", "Your Tulips Unified Admin Center login code")
      .input("body", LOGIN_OTP_CODE_BODY)
      .query("INSERT INTO NotificationTemplates ([Key], Subject, Body, IsSystem) VALUES ('login_otp_code', @subject, @body, 1)");
    console.log("Seeded NotificationTemplates row: login_otp_code");
  }

  if (!existingKeys.has("login_success")) {
    await db
      .request()
      .input("subject", "Login Successful — Tulips Unified Admin Center")
      .input("body", LOGIN_SUCCESS_BODY)
      .query("INSERT INTO NotificationTemplates ([Key], Subject, Body, IsSystem) VALUES ('login_success', @subject, @body, 1)");
    console.log("Seeded NotificationTemplates row: login_success");
  }

  console.log("Login OTP columns and notification templates ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

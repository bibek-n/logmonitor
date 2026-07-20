import "dotenv/config";
import { getDb } from "../src/lib/db";

// One-off: the login_otp_code/login_success NotificationTemplates rows were seeded
// (scripts/migrate-login-otp.ts) back when the product was still called "Log Monitor" -
// migrations only insert on first run, so the already-seeded live rows never picked up
// the source-level rename. Patches the live rows directly. Self-deleting after use.
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

  // Only touch rows that still contain the old name verbatim - if an admin already
  // customized the template (Company Settings > Notifications), leave it alone rather
  // than clobbering their edit.
  const otpUpdate = await db
    .request()
    .input("subject", "Your Tulips Unified Admin Center login code")
    .input("body", LOGIN_OTP_CODE_BODY)
    .query(
      "UPDATE NotificationTemplates SET Subject = @subject, Body = @body WHERE [Key] = 'login_otp_code' AND (Subject LIKE '%Log Monitor%' OR Body LIKE '%Log Monitor%')"
    );

  const successUpdate = await db
    .request()
    .input("subject", "Login Successful — Tulips Unified Admin Center")
    .input("body", LOGIN_SUCCESS_BODY)
    .query(
      "UPDATE NotificationTemplates SET Subject = @subject, Body = @body WHERE [Key] = 'login_success' AND (Subject LIKE '%Log Monitor%' OR Body LIKE '%Log Monitor%')"
    );

  console.log(`login_otp_code rows updated: ${otpUpdate.rowsAffected[0]}`);
  console.log(`login_success rows updated: ${successUpdate.rowsAffected[0]}`);

  const result = await db.query`SELECT [Key], Subject FROM NotificationTemplates WHERE [Key] IN ('login_otp_code', 'login_success')`;
  console.log("NotificationTemplates rows now:", result.recordset);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

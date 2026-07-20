import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { validateUserCredentials } from "@/lib/authCore";
import { logLoginAttempt } from "@/lib/loginActivity";
import { generateOtpCode, sendOtpCodeEmail, OTP_EXPIRY_MINUTES } from "@/lib/loginOtp";

// Always responds with HTTP 200 (never 4xx/5xx) — this app's IIS front end intercepts and
// replaces non-2xx response bodies with a generic IIS error page, which would otherwise
// swallow the {ok:false, error} payload the login form needs. See src/app/login/page.tsx.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required." });
  }

  const validation = await validateUserCredentials(username, password);
  if (!validation.ok) {
    await logLoginAttempt(username, false, validation.reason, req);
    return NextResponse.json({ ok: false, error: "Invalid username or password." });
  }

  const { user } = validation;

  // A user who has enrolled an authenticator app uses that instead of the emailed code —
  // no email round-trip needed, and no "no email on file" block either, since the app itself
  // is the second factor. See src/lib/authOptions.ts's authorize() for the matching branch.
  if (user.TotpEnabled) {
    return NextResponse.json({ ok: true, method: "totp" });
  }

  if (!user.Email) {
    await logLoginAttempt(username, false, "No email on file for OTP", req);
    return NextResponse.json({ ok: false, error: "Your account has no email on file — contact your administrator to enable login." });
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, user.Id)
    .input("codeHash", sql.NVarChar, codeHash)
    .query(`
      UPDATE Users SET
        PendingOtpCodeHash = @codeHash,
        PendingOtpExpiresAt = DATEADD(MINUTE, ${OTP_EXPIRY_MINUTES}, SYSUTCDATETIME()),
        PendingOtpAttempts = 0
      WHERE Id = @id
    `);

  // Fire-and-forget, matching sendLoginSuccessEmail's call site in authOptions.ts —
  // sendNotificationEmail() never throws (it's designed to be best-effort), and its result
  // was never even checked here, so awaiting the full raw-SMTP round trip (fresh TCP+TLS
  // handshake every time, no connection pooling) was adding several seconds of pure dead
  // weight to every single login attempt for no functional benefit.
  void sendOtpCodeEmail(user.Email, code);

  return NextResponse.json({ ok: true, method: "email" });
}

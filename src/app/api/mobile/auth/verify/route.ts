import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { validateUserCredentials } from "@/lib/authCore";
import { logLoginAttempt } from "@/lib/loginActivity";
import { OTP_MAX_ATTEMPTS, sendLoginSuccessEmail } from "@/lib/loginOtp";
import { issueMobileToken } from "@/lib/mobileAuth";

// Mobile equivalent of authOptions.ts's credentials authorize() - same "commit" semantics
// (clears the pending OTP, only on real success) but issues a portable JWT instead of a
// browser session cookie, since a native app has no cookie jar to rely on. Always 200, same
// IIS-body-swallowing reason as the web login routes.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const otp = typeof body?.otp === "string" ? body.otp : "";
  if (!username || !password || !otp) {
    return NextResponse.json({ ok: false, error: "Username, password, and code are required." });
  }

  const validation = await validateUserCredentials(username, password);
  if (!validation.ok) {
    await logLoginAttempt(username, false, validation.reason, req);
    return NextResponse.json({ ok: false, error: "Invalid username or password." });
  }

  const { user } = validation;
  if (!user.PendingOtpExpiresAt || new Date(user.PendingOtpExpiresAt).getTime() < Date.now()) {
    await logLoginAttempt(username, false, "OTP expired", req);
    return NextResponse.json({ ok: false, error: "OTP_EXPIRED" });
  }
  if (user.PendingOtpAttempts >= OTP_MAX_ATTEMPTS) {
    await logLoginAttempt(username, false, "OTP attempts exceeded", req);
    return NextResponse.json({ ok: false, error: "OTP_LOCKED" });
  }

  const otpValid = user.PendingOtpCodeHash ? await bcrypt.compare(otp, user.PendingOtpCodeHash) : false;
  if (!otpValid) {
    const db = await getDb();
    await db.request().input("id", sql.Int, user.Id).query("UPDATE Users SET PendingOtpAttempts = PendingOtpAttempts + 1 WHERE Id = @id");
    await logLoginAttempt(username, false, "Incorrect OTP code", req);
    return NextResponse.json({ ok: false, error: "OTP_INVALID" });
  }

  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, user.Id)
    .query("UPDATE Users SET PendingOtpCodeHash = NULL, PendingOtpExpiresAt = NULL, PendingOtpAttempts = 0 WHERE Id = @id");

  await logLoginAttempt(username, true, "Mobile app", req);

  if (user.Email) {
    void sendLoginSuccessEmail(user.Email, { name: user.Username, date: new Date().toUTCString(), ip: "mobile app" });
  }

  const token = await issueMobileToken(user.Id, user.Username);
  return NextResponse.json({ ok: true, token, username: user.Username, role: user.Role });
}

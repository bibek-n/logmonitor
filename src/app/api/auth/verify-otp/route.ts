import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { validateUserCredentials } from "@/lib/authCore";
import { logLoginAttempt } from "@/lib/loginActivity";
import { OTP_MAX_ATTEMPTS } from "@/lib/loginOtp";

// Read-only "dry check" — never mutates PendingOtp* on success (that happens when the
// client immediately follows up with the real NextAuth signIn() call, which is what
// actually establishes the session). Only mutates on failure, to increment the attempt
// counter. Always responds 200 for the same IIS-body-swallowing reason as request-otp.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const otp = typeof body?.otp === "string" ? body.otp : "";
  if (!username || !password || !otp) {
    return NextResponse.json({ ok: false, error: "Missing required fields." });
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

  return NextResponse.json({ ok: true });
}

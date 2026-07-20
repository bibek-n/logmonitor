import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb, sql } from "@/lib/db";
import { getUserForOtpCheck } from "@/lib/authCore";
import { logLoginAttempt } from "@/lib/loginActivity";
import { OTP_MAX_ATTEMPTS } from "@/lib/loginOtp";
import { decryptTotpSecret, validateTotpCode, normalizeRecoveryCode } from "@/lib/totp";

// Read-only "dry check" — never mutates PendingOtp* on success (that happens when the
// client immediately follows up with the real NextAuth signIn() call, which is what
// actually establishes the session). Only mutates on failure, to increment the attempt
// counter. Always responds 200 for the same IIS-body-swallowing reason as request-otp.
//
// Deliberately does not re-check the password via bcrypt (see getUserForOtpCheck) — this
// route never issues a session, so skipping that redundant compare here shaves a costly
// bcrypt round-trip off every OTP submission without weakening anything: authorize() in
// authOptions.ts still requires the correct password before any session is actually granted.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const otp = typeof body?.otp === "string" ? body.otp : "";
  const mode = body?.mode === "recovery" ? "recovery" : "totp";
  if (!username || !otp) {
    return NextResponse.json({ ok: false, error: "Missing required fields." });
  }

  const user = await getUserForOtpCheck(username);
  if (!user || user.IsActive === false) {
    await logLoginAttempt(username, false, !user ? "Unknown username" : "Account deactivated", req);
    return NextResponse.json({ ok: false, error: "Invalid username or password." });
  }

  // Authenticator-app path: a dry check only, same contract as the emailed-code path below —
  // the actual "commit" (and, for a recovery code, marking it used) happens in authorize().
  if (user.TotpEnabled) {
    if (mode === "recovery") {
      const codesResult = await (await getDb())
        .request()
        .input("userId", sql.Int, user.Id)
        .query<{ CodeHash: string }>("SELECT CodeHash FROM UserTotpRecoveryCodes WHERE UserId = @userId AND UsedAt IS NULL");
      const normalized = normalizeRecoveryCode(otp);
      const matches = await Promise.all(codesResult.recordset.map((r) => bcrypt.compare(normalized, r.CodeHash)));
      if (!matches.some(Boolean)) {
        await logLoginAttempt(username, false, "Incorrect recovery code", req);
        return NextResponse.json({ ok: false, error: "RECOVERY_INVALID" });
      }
      return NextResponse.json({ ok: true });
    }

    if (!user.TotpSecretEncrypted || !validateTotpCode(decryptTotpSecret(user.TotpSecretEncrypted), otp)) {
      await logLoginAttempt(username, false, "Incorrect authenticator code", req);
      return NextResponse.json({ ok: false, error: "TOTP_INVALID" });
    }
    return NextResponse.json({ ok: true });
  }

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

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByPasswordResetToken, completePasswordReset } from "@/lib/authCore";
import { logAdminAction } from "@/lib/adminAudit";

// Always HTTP 200 - same IIS non-2xx-body-swallowing reasoning as the other /api/auth/*
// routes. Unlike forgot-password, this one DOES return a specific error (invalid/expired
// token, password too short) since by this point the caller already proved they hold the
// one bearer secret that matters - there's no account-enumeration risk left to protect.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing reset token." });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "New password must be at least 8 characters." });
  }

  const user = await getUserByPasswordResetToken(token);
  if (!user) {
    return NextResponse.json({ ok: false, error: "This reset link is invalid or has expired. Request a new one." });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await completePasswordReset(user.Id, passwordHash);

  await logAdminAction({
    admin: { userId: user.Id, username: user.Username },
    section: "account_security",
    action: "reset_password_via_email",
    details: "",
    req,
  });

  return NextResponse.json({ ok: true });
}

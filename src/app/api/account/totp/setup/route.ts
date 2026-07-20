import { NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getUserById } from "@/lib/authCore";
import { generateTotpSecret, buildOtpauthUrl, generateQrDataUrl } from "@/lib/totp";

// Stateless: generates a fresh secret + QR code but writes nothing to the database. Nothing
// persists until /verify-setup proves the user actually scanned it and can produce a valid
// code — so an abandoned setup attempt never leaves a half-configured account behind.
export async function POST() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const user = await getUserById(admin.userId);
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpauthUrl(secret, user.Username);
  const qrDataUrl = await generateQrDataUrl(otpauthUrl);

  return NextResponse.json({ ok: true, secret, otpauthUrl, qrDataUrl });
}

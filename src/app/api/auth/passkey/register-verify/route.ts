import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { RP_ID, ORIGIN, PASSKEY_CHALLENGE_COOKIE } from "@/lib/webauthn";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const expectedChallenge = req.cookies.get(PASSKEY_CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return NextResponse.json({ ok: false, error: "Registration session expired — please try again." });
  }

  const body = await req.json().catch(() => null);
  const deviceLabel = typeof body?.deviceLabel === "string" ? body.deviceLabel.trim().slice(0, 100) : null;
  if (!body?.response) {
    return NextResponse.json({ ok: false, error: "Missing registration response" });
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Verification failed" });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ ok: false, error: "Passkey could not be verified" });
  }

  const { credential } = verification.registrationInfo;
  const db = await getDb();
  await db
    .request()
    .input("userId", sql.Int, admin.userId)
    .input("credentialId", sql.NVarChar, credential.id)
    .input("publicKey", sql.NVarChar, Buffer.from(credential.publicKey).toString("base64"))
    .input("counter", sql.BigInt, credential.counter)
    .input("transports", sql.NVarChar, credential.transports ? credential.transports.join(",") : null)
    .input("deviceLabel", sql.NVarChar, deviceLabel)
    .query(
      "INSERT INTO UserPasskeys (UserId, CredentialId, PublicKey, Counter, Transports, DeviceLabel) VALUES (@userId, @credentialId, @publicKey, @counter, @transports, @deviceLabel)"
    );

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(PASSKEY_CHALLENGE_COOKIE);
  return res;
}

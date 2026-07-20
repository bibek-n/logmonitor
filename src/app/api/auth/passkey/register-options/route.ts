import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { RP_NAME, RP_ID, PASSKEY_CHALLENGE_COOKIE, userIdToHandle, getPasskeysForUser, toWebAuthnCredential } from "@/lib/webauthn";

// Always responds 200 — see other routes in this app for why (IIS replaces non-2xx bodies).
export async function POST() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const existing = await getPasskeysForUser(admin.userId);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: userIdToHandle(admin.userId),
    userName: admin.username,
    // A discoverable (resident) credential is required for the "no username typed at all"
    // login flow — the browser can only offer a usernameless credential picker for keys
    // registered this way.
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: existing.map((row) => {
      const cred = toWebAuthnCredential(row);
      return { id: cred.id, transports: cred.transports };
    }),
  });

  const res = NextResponse.json({ ok: true, options });
  res.cookies.set(PASSKEY_CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return res;
}

import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { RP_ID, PASSKEY_CHALLENGE_COOKIE } from "@/lib/webauthn";

// Public, unauthenticated (this is what makes login without typing a username possible) —
// no allowCredentials means the browser shows its own discoverable-credential picker for
// this RP ID rather than the server needing to know who's signing in ahead of time.
export async function POST() {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
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

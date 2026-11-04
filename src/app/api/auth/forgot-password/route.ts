import { NextRequest, NextResponse } from "next/server";
import { getUserForPasswordReset, issuePasswordResetToken } from "@/lib/authCore";
import { sendPasswordResetEmail, getPasswordResetUrl } from "@/lib/loginOtp";

// Always responds with HTTP 200 and the same generic {ok:true} shape regardless of whether the
// submitted username/email matched an account — same reasoning as request-otp/route.ts for the
// IIS non-2xx-body-swallowing quirk, plus (more importantly here) never letting this endpoint's
// response reveal whether a given username/email exists in the system.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const usernameOrEmail = typeof body?.usernameOrEmail === "string" ? body.usernameOrEmail.trim() : "";

  if (usernameOrEmail) {
    try {
      const user = await getUserForPasswordReset(usernameOrEmail);
      // Deliberately silent (no error returned, no log distinguishing this case) for: no
      // matching account, a deactivated/offboarded account (IsActive = 0 - resetting its
      // password would undo an offboarding "Disable All"), or an account with no email on
      // file to send the link to. All three look identical to the caller.
      if (user && user.IsActive && user.Email) {
        const token = await issuePasswordResetToken(user);
        if (token) {
          void sendPasswordResetEmail(user.Email, user.Username, getPasswordResetUrl(token));
        }
      }
    } catch (err) {
      console.error("[forgot-password] lookup/issue failed:", err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that username or email, we've sent a password reset link.",
  });
}

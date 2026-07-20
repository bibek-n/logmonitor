import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { getDb, sql } from "./db";
import { validateUserCredentials, getUserById } from "./authCore";
import { logLoginAttempt, clientIpFromHeaders } from "./loginActivity";
import { sendLoginSuccessEmail, OTP_MAX_ATTEMPTS } from "./loginOtp";
import { RP_ID, ORIGIN, readChallengeCookie, handleToUserId, getPasskeyByCredentialId, toWebAuthnCredential, updatePasskeyCounter } from "./webauthn";
import { decryptTotpSecret, validateTotpCode, normalizeRecoveryCode } from "./totp";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        otp: { label: "Code", type: "text" },
        totpMode: { label: "Code type", type: "text" },
      },
      // By the time this runs, the login form has already confirmed via
      // /api/auth/request-otp and /api/auth/verify-otp (plain 200-always JSON routes) that
      // the password and code are both correct — those routes exist because this app's IIS
      // front end replaces any non-2xx response body with a generic error page, which would
      // otherwise swallow NextAuth's own 401 JSON responses. This authorize() call is the
      // "commit" step: it re-validates (defense in depth) and, only on success, actually
      // clears the pending OTP and issues the session. A failure here should be rare (a
      // race between verify-otp and this call) — it still returns null/401 same as always,
      // which in that rare case would also get its body swallowed by IIS, but the login
      // form has its own fallback message for that.
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password || !credentials?.otp) return null;

        const validation = await validateUserCredentials(credentials.username, credentials.password);
        if (!validation.ok) {
          await logLoginAttempt(credentials.username, false, validation.reason, req);
          return null;
        }

        const { user } = validation;

        // Authenticator-app users skip the emailed-code path entirely — request-otp never
        // issued a PendingOtpCodeHash for them, so re-checking that path here would always
        // fail. verify-otp already dry-checked the same code; this is the actual commit
        // (and, for a recovery code, the point where it gets marked used-once).
        if (user.TotpEnabled) {
          const mode = credentials.totpMode === "recovery" ? "recovery" : "totp";
          const db = await getDb();

          if (mode === "recovery") {
            const codesResult = await db
              .request()
              .input("userId", sql.Int, user.Id)
              .query<{ Id: number; CodeHash: string }>("SELECT Id, CodeHash FROM UserTotpRecoveryCodes WHERE UserId = @userId AND UsedAt IS NULL");
            const normalized = normalizeRecoveryCode(credentials.otp);
            let matchedId: number | null = null;
            for (const row of codesResult.recordset) {
              if (await bcrypt.compare(normalized, row.CodeHash)) {
                matchedId = row.Id;
                break;
              }
            }
            if (matchedId === null) {
              await logLoginAttempt(credentials.username, false, "Incorrect recovery code", req);
              return null;
            }
            await db.request().input("id", sql.Int, matchedId).query("UPDATE UserTotpRecoveryCodes SET UsedAt = SYSUTCDATETIME() WHERE Id = @id");
          } else {
            if (!user.TotpSecretEncrypted || !validateTotpCode(decryptTotpSecret(user.TotpSecretEncrypted), credentials.otp)) {
              await logLoginAttempt(credentials.username, false, "Incorrect authenticator code", req);
              return null;
            }
          }

          await logLoginAttempt(credentials.username, true, mode === "recovery" ? "Recovery code" : "Authenticator app", req);

          if (user.Email) {
            const ip = clientIpFromHeaders(req?.headers) ?? "unknown";
            void sendLoginSuccessEmail(user.Email, { name: user.Username, date: new Date().toUTCString(), ip });
          }

          return { id: String(user.Id), name: user.Username, role: user.Role };
        }

        if (!user.PendingOtpExpiresAt || new Date(user.PendingOtpExpiresAt).getTime() < Date.now()) {
          await logLoginAttempt(credentials.username, false, "OTP expired", req);
          return null;
        }
        if (user.PendingOtpAttempts >= OTP_MAX_ATTEMPTS) {
          await logLoginAttempt(credentials.username, false, "OTP attempts exceeded", req);
          return null;
        }

        const otpValid = user.PendingOtpCodeHash ? await bcrypt.compare(credentials.otp, user.PendingOtpCodeHash) : false;
        if (!otpValid) {
          const db = await getDb();
          await db.request().input("id", sql.Int, user.Id).query("UPDATE Users SET PendingOtpAttempts = PendingOtpAttempts + 1 WHERE Id = @id");
          await logLoginAttempt(credentials.username, false, "Incorrect OTP code", req);
          return null;
        }

        const db = await getDb();
        await db
          .request()
          .input("id", sql.Int, user.Id)
          .query("UPDATE Users SET PendingOtpCodeHash = NULL, PendingOtpExpiresAt = NULL, PendingOtpAttempts = 0 WHERE Id = @id");

        await logLoginAttempt(credentials.username, true, null, req);

        if (user.Email) {
          const ip = clientIpFromHeaders(req?.headers) ?? "unknown";
          void sendLoginSuccessEmail(user.Email, { name: user.Username, date: new Date().toUTCString(), ip });
        }

        return {
          id: String(user.Id),
          name: user.Username,
          role: user.Role,
        };
      },
    }),
    // Face ID / passkey sign-in — no username or password entered anywhere in this flow.
    // The browser's discoverable-credential picker (see /api/auth/passkey/auth-options)
    // identifies the account via the credential's own stored userHandle; this authorize()
    // is where that assertion actually gets cryptographically verified against the stored
    // public key, mirroring how the OTP provider above does its "commit" verification.
    CredentialsProvider({
      id: "webauthn",
      name: "Passkey",
      credentials: {
        assertion: { label: "Assertion", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.assertion) return null;

        const expectedChallenge = readChallengeCookie(req?.headers);
        if (!expectedChallenge) return null;

        let assertion;
        try {
          assertion = JSON.parse(credentials.assertion);
        } catch {
          return null;
        }

        const userHandle: string | undefined = assertion?.response?.userHandle;
        const credentialId: string | undefined = assertion?.id;
        if (!userHandle || !credentialId) return null;

        const userId = handleToUserId(userHandle);
        if (!userId) return null;

        const stored = await getPasskeyByCredentialId(credentialId);
        if (!stored || stored.userId !== userId) {
          await logLoginAttempt(`user#${userId}`, false, "Unknown passkey credential", req);
          return null;
        }

        let verification;
        try {
          verification = await verifyAuthenticationResponse({
            response: assertion,
            expectedChallenge,
            expectedOrigin: ORIGIN,
            expectedRPID: RP_ID,
            credential: toWebAuthnCredential(stored),
          });
        } catch (err) {
          await logLoginAttempt(`user#${userId}`, false, err instanceof Error ? err.message : "Passkey verification failed", req);
          return null;
        }

        if (!verification.verified) {
          await logLoginAttempt(`user#${userId}`, false, "Passkey signature invalid", req);
          return null;
        }

        const user = await getUserById(userId);
        if (!user || user.IsActive === false) {
          await logLoginAttempt(`user#${userId}`, false, "Account inactive or missing", req);
          return null;
        }

        await updatePasskeyCounter(credentialId, verification.authenticationInfo.newCounter);
        await logLoginAttempt(user.Username, true, "Passkey", req);

        if (user.Email) {
          const ip = clientIpFromHeaders(req?.headers) ?? "unknown";
          void sendLoginSuccessEmail(user.Email, { name: user.Username, date: new Date().toUTCString(), ip });
        }

        return {
          id: String(user.Id),
          name: user.Username,
          role: user.Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.userId = (user as { id?: string }).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { id?: string }).id = token.userId as string | undefined;
      }
      return session;
    },
  },
};

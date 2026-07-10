import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb, sql } from "./db";
import { validateUserCredentials } from "./authCore";
import { logLoginAttempt, clientIpFromHeaders } from "./loginActivity";
import { sendLoginSuccessEmail, OTP_MAX_ATTEMPTS } from "./loginOtp";

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

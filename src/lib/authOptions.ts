import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getDb, sql } from "./db";

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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const db = await getDb();
        const result = await db
          .request()
          .input("username", sql.NVarChar, credentials.username)
          .query(
            "SELECT Id, Username, PasswordHash, Role FROM Users WHERE Username = @username"
          );

        const user = result.recordset[0];
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.PasswordHash);
        if (!valid) return null;

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

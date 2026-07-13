import { SignJWT, jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

// Separate from NextAuth's own session mechanism (cookie-based, browser-only) - the mobile
// app needs a portable bearer token it can store and send on every request instead. Falls
// back to NEXTAUTH_SECRET if MOBILE_JWT_SECRET isn't set, but a dedicated secret is
// recommended so mobile tokens can be revoked independently of web sessions.
const SECRET = new TextEncoder().encode(process.env.MOBILE_JWT_SECRET || process.env.NEXTAUTH_SECRET || "");
const TOKEN_TTL = "30d";

export interface MobileAdminSession {
  userId: number;
  username: string;
}

export async function issueMobileToken(userId: number, username: string): Promise<string> {
  return new SignJWT({ userId, username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

async function resolveMobileSession(req: NextRequest): Promise<MobileAdminSession | null> {
  const authHeader = req.headers.get("authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const { payload } = await jwtVerify(match[1], SECRET);
    if (typeof payload.userId !== "number" || typeof payload.username !== "string") return null;
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

// Always 200, even on auth failure - this app's IIS front end replaces any non-2xx response
// body with a generic HTML error page (see every other route in this codebase for the same
// reason), which would otherwise turn a clean {ok:false} into unparseable HTML for the app.
export async function requireMobileAdmin(req: NextRequest): Promise<MobileAdminSession | NextResponse> {
  const session = await resolveMobileSession(req);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }
  return session;
}

export function isMobileSession(value: MobileAdminSession | NextResponse): value is MobileAdminSession {
  return !(value instanceof NextResponse);
}

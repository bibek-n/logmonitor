import createMiddleware from "next-intl/middleware";
import { withAuth } from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { MAINTENANCE_COOKIE } from "./lib/maintenanceFlag";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const authMiddleware = withAuth({
  pages: {
    signIn: "/login",
  },
});

// Exactly the API prefixes the pre-i18n middleware gated — kept as an explicit list
// (rather than widening to "/api/:path*") so agent endpoints, NextAuth's own /api/auth/*
// routes, and every other API route continue to bypass this middleware entirely, unchanged.
const GATED_API_PREFIXES = ["/api/tools", "/api/audit", "/api/email-test", "/api/speed-test", "/api/whatismyip"];

// Maintenance mode check runs first, ahead of the normal auth middleware, and stays
// Edge-safe (cookie + JWT claim only — no direct DB call; see src/lib/maintenanceFlag.ts
// for why). Admins always pass through so they can reach /dashboard/settings to turn
// maintenance mode back off.
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;
  const isDashboardOrGatedApi =
    pathname.startsWith("/dashboard") || GATED_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (isDashboardOrGatedApi) {
    if (pathname.startsWith("/dashboard") && req.cookies.get(MAINTENANCE_COOKIE)?.value === "1") {
      try {
        const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
        const role = (token as { role?: string } | null)?.role;
        if (role !== "Admin") {
          return NextResponse.redirect(new URL("/maintenance", req.url));
        }
      } catch {
        // If token verification fails for any reason, fall through to normal auth handling
        // rather than risk locking everyone out on a transient error.
      }
    }

    // @ts-expect-error - withAuth's returned handler matches the standard middleware signature at runtime
    return (await authMiddleware(req, event)) ?? NextResponse.next();
  }

  // Everything else (public website, /login, /maintenance) goes through locale resolution.
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/tools/:path*",
    "/api/audit/:path*",
    "/api/email-test/:path*",
    "/api/speed-test/:path*",
    "/api/whatismyip/:path*",
    "/",
    "/(en|es|fr|de|ne|hi)/:path*",
    "/about-software",
    "/about-us",
    "/contact",
    "/services",
    "/support",
    "/support/:path*",
    "/privacy-policy",
    "/terms",
    "/login",
    "/maintenance",
  ],
};

import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/tools/:path*",
    "/api/audit/:path*",
    "/api/email-test/:path*",
    "/api/speed-test/:path*",
    "/api/whatismyip/:path*",
  ],
};

import { getDb, sql } from "./db";

export function clientIpFromHeaders(headers: Record<string, unknown> | Headers | undefined): string | null {
  if (!headers) return null;
  const forwarded = headers instanceof Headers ? headers.get("x-forwarded-for") : (headers["x-forwarded-for"] as string | undefined);
  if (!forwarded) return null;
  return String(forwarded).split(",")[0].trim();
}

export async function logLoginAttempt(
  username: string,
  success: boolean,
  failureReason: string | null,
  req?: { headers?: Record<string, unknown> | Headers }
) {
  try {
    const db = await getDb();
    await db
      .request()
      .input("username", sql.NVarChar, username)
      .input("ipAddress", sql.NVarChar, clientIpFromHeaders(req?.headers))
      .input("userAgent", sql.NVarChar, req?.headers instanceof Headers ? req.headers.get("user-agent") : null)
      .input("success", sql.Bit, success)
      .input("failureReason", sql.NVarChar, failureReason)
      .query(
        "INSERT INTO LoginActivity (Username, IpAddress, UserAgent, Success, FailureReason) VALUES (@username, @ipAddress, @userAgent, @success, @failureReason)"
      );
  } catch {
    // LoginActivity table may not exist yet on older deployments — never block sign-in on this.
  }
}

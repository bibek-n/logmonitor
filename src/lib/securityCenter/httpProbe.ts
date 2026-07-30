import http from "http";
import https from "https";
import { checkLiteralIpNotRestricted, createSafeLookup } from "../websiteApiMonitoring/ssrfGuard";

const PROBE_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 512 * 1024; // enough to see full-page content for signature checks, bounded
const MAX_REDIRECTS = 3;
const USER_AGENT = "LogMonitor-SecurityCenter-VulnerabilityScanner/1.0";

export interface ProbeResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
}

// Every Vulnerability Scanner check goes through this - never raw fetch() - because scan
// targets can be an admin-typed ad-hoc URL (see schema.ts's authorizationConfirmed path), which
// makes this scanner itself a potential SSRF vector against internal infrastructure if it isn't
// guarded. Reuses the exact same SSRF guard Website & API Monitoring already built (hooks
// Node's `lookup` option so the IP actually connected to is validated, not just an earlier,
// separately-resolved one - closing the DNS-rebinding gap a naive resolve-then-connect check
// would leave open), re-validated on every redirect hop.
export async function probeUrl(
  targetUrl: string,
  opts: { method?: "GET" | "HEAD"; headers?: Record<string, string>; followRedirects?: boolean } = {}
): Promise<ProbeResult> {
  const method = opts.method ?? "GET";
  const followRedirects = opts.followRedirects ?? true;

  let currentUrl = targetUrl;
  for (let redirectCount = 0; ; redirectCount++) {
    const u = new URL(currentUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error(`Unsupported protocol "${u.protocol}" - only http and https are allowed.`);
    }
    checkLiteralIpNotRestricted(u.hostname);

    const result = await singleRequest(currentUrl, method, opts.headers ?? {});

    const isRedirect = result.statusCode >= 300 && result.statusCode < 400 && result.headers["location"];
    if (isRedirect && followRedirects && redirectCount < MAX_REDIRECTS) {
      currentUrl = new URL(result.headers["location"] as string, currentUrl).toString();
      continue;
    }
    return { ...result, finalUrl: currentUrl };
  }
}

function singleRequest(targetUrl: string, method: "GET" | "HEAD", extraHeaders: Record<string, string>): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const isHttps = u.protocol === "https:";

    const req = (isHttps ? https : http).request(
      targetUrl,
      {
        method,
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*", ...extraHeaders },
        timeout: PROBE_TIMEOUT_MS,
        // Certificate validity isn't this scanner's concern (Weak SSL/TLS check reads
        // SslCertificateRecords separately) - probing must still succeed against a
        // self-signed/expired cert so the other 11 checks aren't blocked by it.
        rejectUnauthorized: false,
        lookup: createSafeLookup(),
        autoSelectFamily: false,
      } as https.RequestOptions & { autoSelectFamily?: boolean },
      (res) => {
        let totalBytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes <= MAX_BODY_BYTES) chunks.push(chunk);
        });
        res.on("end", () => {
          // set-cookie is joined with "\n", never ", " - a Set-Cookie's own Expires attribute
          // contains a literal comma ("Expires=Wed, 21 Oct 2025..."), so comma-joining would
          // corrupt multi-cookie responses in a way that's silently wrong, not just ugly.
          const headers: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") headers[key.toLowerCase()] = value;
            else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(key.toLowerCase() === "set-cookie" ? "\n" : ", ");
          }
          resolve({ statusCode: res.statusCode ?? 0, headers, body: Buffer.concat(chunks).toString("utf8"), finalUrl: targetUrl });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new Error("Request timed out.")));
    req.on("error", reject);
    req.end();
  });
}

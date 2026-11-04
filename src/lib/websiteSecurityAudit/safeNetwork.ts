import { Agent } from "undici";
import { checkLiteralIpNotRestricted, createSafeLookup, SsrfBlockedError } from "@/lib/websiteApiMonitoring/ssrfGuard";

// This server has a documented, previously-confirmed bug: its network path silently rewrites
// plain (port 53) DNS answers for certain domains to a bogus loopback address, even when
// explicitly querying public resolvers directly (see ssrfGuard.ts's own comment, written
// after live observation). The Website & API Monitoring engine already works around this via
// createSafeLookup() (DNS-over-HTTPS instead of the OS resolver). The Website Security Audit
// scanner never adopted that fix - every fetch()/tls.connect() call here used Node's default
// resolver, so a scan against one of the affected domains could come back falsely
// "Unreachable" (forced to score 0 / Critical risk) with nothing actually wrong on the target
// site. This file ports that same proven fix in, read-only (no changes to ssrfGuard.ts
// itself, which the Monitoring engine already depends on in production).
export { SsrfBlockedError };

const SAFE_LOOKUP = createSafeLookup();
const SAFE_DISPATCHER = new Agent({ connect: { lookup: SAFE_LOOKUP } });

// For tls.connect()'s own `lookup` option (runScan.ts's TLS checks, performanceChecks.ts's
// ALPN/HTTP2 check) - tls.connect accepts the exact same Node-style lookup callback signature
// http(s).request() does, so the one function covers both.
export const safeTlsLookup = SAFE_LOOKUP;

const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";
const DEFAULT_TIMEOUT_MS = 15000;

// Drop-in replacement for fetch() for every call in this scanner that targets the site under
// audit (or a resource its page references, e.g. a <script src>) - never used for this
// scanner's own trusted third-party lookups (OSV's CVE database, ip-api.com, dns.google),
// which aren't subject to the target-site DNS confusion this exists to fix.
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const hostname = new URL(url).hostname;
  checkLiteralIpNotRestricted(hostname); // throws synchronously if the URL is already a literal restricted IP
  return fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    headers: { "User-Agent": UA },
    ...init,
    // Cast needed - `dispatcher` is a real, Node-supported (undici) fetch option not yet
    // reflected in the DOM-derived RequestInit type this project's TS lib target uses.
    ...({ dispatcher: SAFE_DISPATCHER } as Record<string, unknown>),
  } as RequestInit);
}

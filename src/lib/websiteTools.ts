import tls from "tls";

const FETCH_TIMEOUT_MS = 15000;

export function isValidUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

export async function websiteHealthCheck(inputUrl: string): Promise<string> {
  const start = Date.now();
  try {
    const res = await fetch(inputUrl, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const elapsed = Date.now() - start;
    const bodyText = await res.text();

    const lines = [
      `URL: ${inputUrl}`,
      `Final URL: ${res.url}`,
      `Status: ${res.status} ${res.statusText}`,
      `Response Time: ${elapsed}ms`,
      `Redirected: ${res.redirected ? "yes" : "no"}`,
      `Content-Type: ${res.headers.get("content-type") ?? "-"}`,
      `Body Size: ${bodyText.length} bytes`,
    ];
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(bodyText);
    if (titleMatch) lines.push(`Page Title: ${titleMatch[1].trim()}`);
    lines.push("");
    lines.push(res.ok ? "✓ Site is UP and responding normally." : `⚠ Site responded with a non-2xx status (${res.status}).`);
    return lines.join("\n");
  } catch (err) {
    return [
      `URL: ${inputUrl}`,
      "Status: UNREACHABLE",
      `Error: ${err instanceof Error ? err.message : "Request failed"}`,
      "",
      "✗ Site is DOWN or unreachable from this server (this could also mean an invalid/expired SSL certificate — check the SSL/TLS Certificate Checker).",
    ].join("\n");
  }
}

export async function headerViewer(inputUrl: string): Promise<string> {
  const res = await fetch(inputUrl, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const lines = [`${inputUrl} -> ${res.status} ${res.statusText}`, `Final URL: ${res.url}`, ""];
  res.headers.forEach((value, key) => lines.push(`${key}: ${value}`));
  return lines.join("\n");
}

export async function gaTagFinder(inputUrl: string): Promise<string> {
  const res = await fetch(inputUrl, { redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const html = await res.text();

  const ga4Ids = new Set([...html.matchAll(/\bG-[A-Z0-9]{6,}\b/g)].map((m) => m[0]));
  const uaIds = new Set([...html.matchAll(/\bUA-\d{4,}-\d+\b/g)].map((m) => m[0]));
  const gtmIds = new Set([...html.matchAll(/\bGTM-[A-Z0-9]{4,}\b/g)].map((m) => m[0]));
  const hasGtagScript = /googletagmanager\.com\/gtag\/js/.test(html);
  const hasAnalyticsJs = /google-analytics\.com\/analytics\.js/.test(html);
  const hasGtmScript = /googletagmanager\.com\/gtm\.js/.test(html);
  const hasDataLayer = /dataLayer\s*=/.test(html);

  const lines = [`GA / GTM scan for ${inputUrl}:`, ""];
  if (ga4Ids.size) lines.push(`GA4 Measurement ID(s): ${[...ga4Ids].join(", ")}`);
  if (uaIds.size) lines.push(`Universal Analytics ID(s) (legacy, deprecated by Google): ${[...uaIds].join(", ")}`);
  if (gtmIds.size) lines.push(`Google Tag Manager ID(s): ${[...gtmIds].join(", ")}`);
  if (!ga4Ids.size && !uaIds.size && !gtmIds.size) lines.push("No Google Analytics or Tag Manager IDs found in the page HTML.");
  lines.push("");
  lines.push(`gtag.js script tag present: ${hasGtagScript ? "yes" : "no"}`);
  lines.push(`analytics.js (legacy) script tag present: ${hasAnalyticsJs ? "yes" : "no"}`);
  lines.push(`gtm.js script tag present: ${hasGtmScript ? "yes" : "no"}`);
  lines.push(`dataLayer variable present: ${hasDataLayer ? "yes" : "no"}`);
  lines.push("");
  lines.push("Note: this only scans the initial HTML response — tags injected purely by client-side JavaScript after page load won't be detected.");
  return lines.join("\n");
}

export function sslCertCheck(inputUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let host: string;
    let port: number;
    try {
      const u = new URL(inputUrl.includes("://") ? inputUrl : `https://${inputUrl}`);
      host = u.hostname;
      port = u.port ? Number(u.port) : 443;
    } catch {
      reject(new Error("Invalid URL or hostname."));
      return;
    }

    const socket = tls.connect(
      { host, port, servername: host, rejectUnauthorized: false, timeout: 10000 },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0) {
          socket.end();
          resolve(`No certificate was presented by ${host}:${port}.`);
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysLeft = Math.floor((validTo.getTime() - now.getTime()) / 86400000);
        const expiryNote = daysLeft < 0 ? " (EXPIRED)" : daysLeft < 30 ? " (expiring soon)" : "";

        const lines = [
          `Host: ${host}:${port}`,
          `Subject: ${cert.subject?.CN ?? "-"}`,
          `Issuer: ${cert.issuer?.O ?? cert.issuer?.CN ?? "-"}`,
          `Valid From: ${validFrom.toISOString()}`,
          `Valid To: ${validTo.toISOString()}`,
          `Days Until Expiry: ${daysLeft}${expiryNote}`,
          `Protocol: ${socket.getProtocol() ?? "-"}`,
          `Chain Trusted: ${socket.authorized ? "yes" : `no (${socket.authorizationError})`}`,
        ];
        if (cert.subjectaltname) lines.push(`Subject Alternative Names: ${cert.subjectaltname}`);
        socket.end();
        resolve(lines.join("\n"));
      }
    );
    socket.on("error", (err) => reject(err));
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Connection timed out."));
    });
  });
}

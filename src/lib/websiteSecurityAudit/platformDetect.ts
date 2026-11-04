import type { Finding } from "./types";

export interface TechSignals {
  analytics: string[];
  tagManager: string[];
  theme: string | null;
}

// Reuses the same regex-over-fetched-HTML approach as the standalone GA Tag Finder tool,
// just folded into the scan pipeline as additional technology-stack signals rather than a
// second fetch.
export function detectTechSignals(html: string): TechSignals {
  const analytics: string[] = [];
  if (/google-analytics\.com\/analytics\.js|gtag\(['"]config['"]|G-[A-Z0-9]{6,}/i.test(html)) analytics.push("Google Analytics");
  if (/hotjar\.com/i.test(html)) analytics.push("Hotjar");
  if (/facebook\.net\/en_US\/fbevents\.js|fbq\(/i.test(html)) analytics.push("Meta Pixel");
  if (/matomo\.js|piwik\.js/i.test(html)) analytics.push("Matomo");

  const tagManager: string[] = [];
  if (/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+/i.test(html)) tagManager.push("Google Tag Manager");

  const theme = /wp-content\/themes\/([a-z0-9_-]+)/i.exec(html)?.[1] ?? null;

  return { analytics, tagManager, theme };
}

interface VulnerableLibrary {
  name: string;
  pattern: RegExp;
  extractVersion: RegExp;
  maxSafeVersionExclusive: string;
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// A small curated table of widely-known outdated-version cutoffs for common front-end
// libraries with public CVEs — not a live feed (matches this app's existing
// KNOWN_EOL_PACKAGES precedent in dependencyChecks.ts), just well-documented safe-version
// lines. Version is read from the <script src> URL/filename, since that's what's visible
// without executing any JS.
const VULNERABLE_JS_LIBRARIES: VulnerableLibrary[] = [
  { name: "jQuery", pattern: /jquery/i, extractVersion: /jquery[.-]?(\d+\.\d+(?:\.\d+)?)/i, maxSafeVersionExclusive: "3.5.0" },
  { name: "Bootstrap", pattern: /bootstrap/i, extractVersion: /bootstrap[.-]?(\d+\.\d+(?:\.\d+)?)/i, maxSafeVersionExclusive: "4.3.1" },
  { name: "AngularJS", pattern: /angular(?!\.io)/i, extractVersion: /angular(?:\.js)?[.-]?(\d+\.\d+(?:\.\d+)?)/i, maxSafeVersionExclusive: "1.8.0" },
  { name: "Lodash", pattern: /lodash/i, extractVersion: /lodash[.-]?(\d+\.\d+(?:\.\d+)?)/i, maxSafeVersionExclusive: "4.17.21" },
];

export function detectVulnerableJsLibraries(html: string): Finding[] {
  const findings: Finding[] = [];
  const scriptSrcs = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);

  for (const lib of VULNERABLE_JS_LIBRARIES) {
    for (const src of scriptSrcs) {
      if (!lib.pattern.test(src)) continue;
      const version = lib.extractVersion.exec(src)?.[1];
      if (!version) continue;
      if (compareVersions(version, lib.maxSafeVersionExclusive) < 0) {
        findings.push({
          category: "outdated_js_library",
          severity: "medium",
          title: `Outdated ${lib.name} version ${version} detected`,
          evidence: src,
          recommendation: `Upgrade ${lib.name} to ${lib.maxSafeVersionExclusive} or later.`,
        });
      }
      break;
    }
  }
  return findings;
}

// Best-effort cutoff based on PHP's publicly documented support lifecycle (updated
// periodically, same pattern as WORDPRESS_MIN_SUPPORTED_MINOR in cmsChecks.ts) — not a
// live feed. Runs for every site regardless of detected platform, since PHP can power a
// site even when the CMS/framework on top (WordPress, Laravel) is what got detected.
const PHP_MIN_SUPPORTED_MINOR = 8.2;

// Shared with the standalone "PHP Version" column/scan on the Websites list
// (src/app/dashboard/audit/websites/actions.ts) so both places agree on exactly what
// counts as a detected version, instead of two regexes drifting apart over time.
export function extractPhpVersion(headers: Headers): string | null {
  const poweredBy = headers.get("x-powered-by") ?? "";
  const match = /PHP\/(\d+\.\d+)(\.\d+)?/i.exec(poweredBy);
  if (!match) return null;
  return `${match[1]}${match[2] ?? ""}`;
}

// Shared with the "PHP Version" column on the Websites list, which flags the same cutoff
// with a red blinking badge - both places need to agree on exactly what counts as EOL/vulnerable.
export function isPhpVersionEol(version: string): boolean {
  const match = /^(\d+\.\d+)/.exec(version);
  if (!match) return false;
  const minor = parseFloat(match[1]);
  return !Number.isNaN(minor) && minor < PHP_MIN_SUPPORTED_MINOR;
}

// Same cutoff as WORDPRESS_MIN_SUPPORTED_MINOR in cmsChecks.ts (kept as a separate constant
// here since that file isn't client-importable) - best-effort "older than the current
// supported release line," not a live CVE feed. Shared with the "Platform" column on the
// Websites list, which flags it with the same red blinking badge as an EOL PHP version.
const WORDPRESS_MIN_SUPPORTED_MINOR = 6.4;

export function isWordPressVersionOutdated(version: string): boolean {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const minor = parseFloat(`${match[1]}.${match[2]}`);
  return !Number.isNaN(minor) && minor < WORDPRESS_MIN_SUPPORTED_MINOR;
}

// Red-blink trigger has two independent reasons, either is enough:
//  1) CVE-2025-29927 - critical (CVSS 9.1) Next.js middleware authorization-bypass
//     vulnerability, unpatched point release for that major line.
//  2) Simply outdated - more than one major line behind what's current, same best-effort
//     "older than the current supported line" cutoff pattern as the PHP/WordPress checks
//     above (update NEXTJS_MIN_SUPPORTED_MAJOR periodically, not a live feed). Without this,
//     every site already past its own line's CVE patch point - which in practice is most of
//     them - would never turn red even while running a genuinely old major version.
const NEXTJS_MIN_SUPPORTED_MAJOR = 15;
const NEXTJS_PATCHED_VERSIONS: { major: number; minor: number; patch: number }[] = [
  { major: 12, minor: 3, patch: 5 },
  { major: 13, minor: 5, patch: 9 },
  { major: 14, minor: 2, patch: 25 },
  { major: 15, minor: 2, patch: 3 },
];

export function isNextJsVersionVulnerable(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (major < NEXTJS_MIN_SUPPORTED_MAJOR) return true;
  const rule = NEXTJS_PATCHED_VERSIONS.find((r) => r.major === major);
  if (!rule) return false;
  if (minor !== rule.minor) return minor < rule.minor;
  return patch < rule.patch;
}

export function checkPhpVersion(headers: Headers): Finding[] {
  const findings: Finding[] = [];
  const version = extractPhpVersion(headers);
  if (!version) return findings;

  findings.push({
    category: "php_version_disclosed",
    severity: "low",
    title: `PHP version disclosed: ${version}`,
    recommendation: "Set expose_php = Off in php.ini to stop disclosing the PHP version via the X-Powered-By header.",
  });

  if (isPhpVersionEol(version)) {
    findings.push({
      category: "php_eol_version",
      severity: "high",
      title: `PHP version ${version} appears end-of-life or near end-of-life`,
      description: "This is a best-effort comparison against PHP's publicly documented support lifecycle, not a live feed.",
      recommendation: "Upgrade PHP to a currently-supported version to keep receiving security patches.",
    });
  }
  return findings;
}

// Best-effort fingerprinting via response headers + HTML markers already visible on a
// normal page load — the same non-destructive fetch used by websiteHealthCheck/gaTagFinder,
// just reading a few more signals from the same response. This is a heuristic identical in
// spirit to tools like Wappalyzer, not a certified detector: a platform can hide its
// fingerprints, and one will be reported as "Other" rather than guessed.
export async function detectPlatform(html: string, headers: Headers): Promise<string> {
  const poweredBy = (headers.get("x-powered-by") ?? "").toLowerCase();
  const server = (headers.get("server") ?? "").toLowerCase();

  if (/__next_data__|_next\/static/i.test(html)) return "Next.js";
  if (poweredBy.includes("express") && /react/i.test(html)) return "React";
  if (poweredBy.includes("express")) return "Express";
  if (/wp-content|wp-includes|wordpress/i.test(html)) return "WordPress";
  if (/csrfmiddlewaretoken/i.test(html)) return "Django";
  if (/name=["']flask/i.test(html) || server.includes("werkzeug")) return "Flask";
  if (poweredBy.includes("laravel") || /laravel_session/i.test(html)) return "Laravel";
  if (poweredBy.includes("asp.net") || server.includes("microsoft-iis")) {
    return poweredBy.includes("aspnet_state") || /__viewstate/i.test(html) ? "ASP.NET" : ".NET Core";
  }
  if (poweredBy.includes("php")) return "PHP";
  if (/ng-version|_ngcontent/i.test(html)) return "Angular";
  if (/data-v-app|__vue__/i.test(html)) return "Vue.js";
  if (/csrf-token.*rails|__rails/i.test(html)) return "Ruby on Rails";
  if (server.includes("tomcat") || server.includes("jetty")) return "Spring Boot";
  if (/window\.__NUXT__/i.test(html)) return "Vue.js";
  if (poweredBy.includes("node") || server.includes("node")) return "Node.js";
  if (poweredBy.includes("python")) return "Python";

  return "Other";
}

// WordPress is the one non-PHP-specific platform that commonly self-reports an exact
// version, via <meta name="generator"> on the front end - unless a security plugin strips
// it, which is common enough that null here just means "hidden," not "not WordPress."
export function extractWordPressVersion(html: string): string | null {
  return /<meta\s+name=["']generator["']\s+content=["']WordPress\s+([\d.]+)["']/i.exec(html)?.[1] ?? null;
}

// The Server header occasionally carries a real version for the web server itself (nginx,
// Apache, IIS, openresty, ...) even when nothing else on the page discloses anything -
// useful as a fallback label when no app-level platform/version was found. Reverse proxies
// (cloudflare, cloudfront) report themselves here instead of the origin, which is still
// worth showing (it explains why nothing else came through), just not an app version.
export function extractServerHeaderVersion(headers: Headers): string | null {
  const server = headers.get("server");
  return server && server.trim() ? server.trim() : null;
}

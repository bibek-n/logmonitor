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

export function checkPhpVersion(headers: Headers): Finding[] {
  const findings: Finding[] = [];
  const poweredBy = headers.get("x-powered-by") ?? "";
  const match = /PHP\/(\d+\.\d+)(\.\d+)?/i.exec(poweredBy);
  if (!match) return findings;

  const version = `${match[1]}${match[2] ?? ""}`;
  findings.push({
    category: "php_version_disclosed",
    severity: "low",
    title: `PHP version disclosed: ${version}`,
    recommendation: "Set expose_php = Off in php.ini to stop disclosing the PHP version via the X-Powered-By header.",
  });

  const minor = parseFloat(match[1]);
  if (!Number.isNaN(minor) && minor < PHP_MIN_SUPPORTED_MINOR) {
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

import PDFDocument from "pdfkit";
import { CHECK_LABELS, CHECK_ORDER, type CheckId, type CheckSummary, type DetectedPlugin, type ScanFinding } from "./shared";

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "#b91c1c";
    case "high":
      return "#c2410c";
    case "medium":
      return "#b45309";
    case "low":
      return "#1d4ed8";
    default:
      return "#6b7280";
  }
}

// Mirrors the client-side riskColor() in WordPressScanClient.tsx - "info" reads as a clean
// bill of health (green), "unknown" (the no-WordPress-detected case) stays neutral gray
// rather than implying either good or bad news.
function riskColor(risk: string): string {
  switch (risk) {
    case "critical":
    case "high":
      return "#b91c1c";
    case "medium":
    case "low":
      return "#b45309";
    case "info":
      return "#15803d";
    default:
      return "#6b7280";
  }
}

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "website";
}

export function wordpressScanPdfFilename(websiteName: string, scannedAt: string): string {
  const date = scannedAt.slice(0, 10);
  return `${slugify(websiteName)}-wordpress-audit-${date}.pdf`;
}

function sortBySeverity(findings: ScanFinding[]): ScanFinding[] {
  return [...findings].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
}

// Every check already attaches some remediation detail of its own for vulnerability-style
// findings (the fixed-in version, from the WPScan lookups in checks.ts) - this map only fills
// the gaps: generic "how do I actually fix this" guidance that doesn't vary per-finding, plus
// the two checks (interesting_headers, the REST API user-enum finding) that carry no
// remediation text at all from the scanner itself. Keyed by check, with a couple of per-title
// branches below for interesting_headers, since its five possible header keys each need
// different advice.
const GENERIC_SOLUTIONS: Partial<Record<CheckId, string>> = {
  core_version_vulns:
    "Update WordPress core to the fixed version noted above (or the latest release) via Dashboard → Updates, or `wp core update` if using WP-CLI. Take a backup first.",
  core_update_available:
    "Update now via Dashboard → Updates, or `wp core update`. Always take a backup before updating core.",
  php_compatibility:
    "Raise the site's PHP version in your hosting control panel or server config to the recommended minimum. Test on a staging copy first, since a PHP version bump can affect plugin/theme compatibility.",
  theme_vulns:
    "Update the theme to its fixed version from the WordPress.org theme directory or the vendor, or switch to an actively maintained theme if no fix is available.",
  plugin_vulns:
    "Update the plugin to its fixed version via Dashboard → Plugins, or deactivate and remove it if no fix has been published yet.",
  config_backups:
    "Delete the exposed file immediately. Make sure deploy scripts, editors, and manual database dumps never leave backup files inside the public web root. As defense in depth, add a web-server rule blocking access to common backup extensions (.bak, .old, .sql, .env, ~) site-wide.",
  timthumb:
    "Update to the latest TimThumb (2.8.13+) or replace it with a modern, actively maintained image-resize library. Remove any unused leftover copies from old theme files.",
  wp_cron:
    "Add `define('DISABLE_WP_CRON', true);` to wp-config.php (above the \"That's all, stop editing!\" comment), then add a real system cron job to trigger it on a fixed schedule instead, e.g. every 15 minutes:\n*/15 * * * * curl -s https://example.com/wp-cron.php > /dev/null 2>&1\nAlternatively, block public access to /wp-cron.php at the web-server level and allow it only from localhost if the cron job runs on the same machine.",
};

function headerSolution(title: string): string {
  const key = title.split(":")[0].trim().toLowerCase();
  switch (key) {
    case "server":
      return "On the web server, suppress the version/OS detail: for nginx, add `server_tokens off;` inside the http {} block and reload; for Apache, set `ServerTokens Prod` and `ServerSignature Off` in the server config. A reverse proxy/WAF rule can strip the Server header entirely as an alternative.";
    case "x-powered-by":
      return "Disable PHP's own header: set `expose_php = Off` in php.ini and restart PHP-FPM/Apache. If a framework or proxy is adding this header separately, remove or override it in that layer's config.";
    case "x-generator":
      return "Remove the WordPress generator meta tag: add `remove_action('wp_head', 'wp_generator');` to the theme's functions.php, or use a lightweight \"Remove Generator Tag\" plugin.";
    case "via":
      return "This header is typically added by a caching layer, CDN, or reverse proxy in front of the site. Check that intermediary's configuration for an option to suppress or anonymize it.";
    case "x-pingback":
      return "Disable XML-RPC pingback: add `add_filter('xmlrpc_methods', function ($methods) { unset($methods['pingback.ping']); return $methods; });` to functions.php, or block /xmlrpc.php entirely at the web server if nothing on the site depends on it (Jetpack and some mobile apps do).";
    default:
      return "Review why this header is being sent and whether it needs to disclose this level of detail publicly; most web servers/frameworks offer a config option to suppress or override it.";
  }
}

function solutionFor(f: ScanFinding): string | null {
  if (f.check === "interesting_headers") {
    if (f.title.startsWith("WP REST API discovery link")) {
      return "This is normal/expected for most sites (the REST API is used by the block editor and many plugins) and isn't itself a vulnerability. If the REST API isn't needed publicly, it can be hidden via `remove_action('wp_head', 'rest_output_link_wp_head');`, but confirm nothing on the site depends on it first.";
    }
    return headerSolution(f.title);
  }
  if (f.check === "user_enum_xmlrpc") {
    if (f.title.startsWith("WP REST API user enumeration")) {
      return "Restrict /wp-json/wp/v2/users to authenticated requests, e.g. with a `rest_authentication_errors` filter that blocks anonymous access to the users endpoint, or a security plugin (Wordfence, iThemes Security) that offers this as a built-in option.";
    }
    // "XML-RPC is enabled" already carries its own remediation in `detail`.
    return null;
  }
  return GENERIC_SOLUTIONS[f.check] ?? null;
}

export interface WordPressScanPdfInput {
  websiteName: string;
  targetUrl: string;
  isWordPress: boolean;
  coreVersion: string | null;
  phpVersion: string | null;
  latestCoreVersion: string | null;
  themeSlug: string | null;
  themeVersion: string | null;
  plugins: DetectedPlugin[];
  findings: ScanFinding[];
  checks: CheckSummary[];
  riskLevel: string;
  scannedAt: string;
  triggeredByUsername: string | null;
}

export async function generateWordPressScanPdf(r: WordPressScanPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  function heading(text: string) {
    doc.moveDown(0.8);
    doc.fontSize(14).fillColor("#000").text(text);
    doc.moveDown(0.3);
  }

  function subheading(text: string) {
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor("#000").text(text);
    doc.moveDown(0.15);
  }

  function body(text: string, color = "#333") {
    doc.fontSize(9.5).fillColor(color).text(text);
  }

  function mono(text: string, color = "#111") {
    doc.font("Courier").fontSize(9).fillColor(color).text(text);
    doc.font("Helvetica");
  }

  // --- Title ---
  doc.fontSize(20).fillColor("#000").text("WordPress Security Audit Report");
  doc.moveDown(0.2);
  doc.fontSize(12).fillColor("#555").text(r.websiteName);
  doc.fontSize(10).fillColor("#555").text(r.targetUrl);
  doc.moveDown(0.5);

  const metaRows: [string, string][] = [
    ["Scanned URL", r.targetUrl],
    ["Scan date", new Date(r.scannedAt).toLocaleString()],
    ["Scanned by", r.triggeredByUsername ?? "unknown"],
    ["Overall risk rating", r.riskLevel.toUpperCase()],
  ];
  if (r.isWordPress) {
    metaRows.push(
      ["WordPress core version", `${r.coreVersion ?? "unknown"}${r.latestCoreVersion ? ` (latest: ${r.latestCoreVersion})` : ""}`],
      ["PHP version", r.phpVersion ?? "unknown"],
      ["Active theme", r.themeSlug ? `${r.themeSlug}${r.themeVersion ? ` v${r.themeVersion}` : ""}` : "unknown"],
      ["Detected plugins", r.plugins.length > 0 ? r.plugins.map((p) => `${p.slug}${p.version ? ` v${p.version}` : ""}`).join(", ") : "none detected from page assets"]
    );
  }
  for (const [label, value] of metaRows) {
    doc.fontSize(9.5).fillColor("#555").text(label, { continued: true, width: 150 });
    doc.fillColor(label === "Overall risk rating" ? riskColor(r.riskLevel) : "#000").text(`   ${value}`);
  }

  if (!r.isWordPress) {
    heading("Result");
    body(
      `WordPress was not detected at ${r.targetUrl} — no wp-content/wp-includes/wp-json markers were found on this page. This can mean the site genuinely isn't WordPress, the configured URL is wrong/stale, or the page served (e.g. a renamed admin/login path) happens to carry no front-end asset references. No further checks were run.`,
      "#333"
    );
    doc.end();
    return done;
  }

  // --- Checks summary ---
  heading("Checks Summary");
  const checksByCheck = new Map(r.checks.map((c) => [c.check, c]));
  const colX = [doc.page.margins.left, doc.page.margins.left + 320, doc.page.margins.left + 420];
  const headerY = doc.y;
  doc.fontSize(9).fillColor("#555");
  doc.text("Check", colX[0], headerY);
  doc.text("Status", colX[1], headerY);
  doc.text("Findings", colX[2], headerY);
  doc.x = doc.page.margins.left;
  doc.y = headerY + 14;
  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.3);

  for (const id of CHECK_ORDER) {
    const c = checksByCheck.get(id);
    const status = c?.status ?? "not_applicable";
    const statusText = status === "issues_found" ? "Issues found" : status === "error" ? "Check failed" : status === "ok" ? "Clear" : "Not run";
    const statusColor = status === "issues_found" ? "#b45309" : status === "error" ? "#b91c1c" : "#15803d";
    const rowY = doc.y;
    doc.fontSize(9.5).fillColor("#333").text(CHECK_LABELS[id], colX[0], rowY, { width: 300 });
    doc.fillColor(statusColor).text(statusText, colX[1], rowY, { width: 95 });
    doc.fillColor("#333").text(String(c?.findingCount ?? 0), colX[2], rowY);
    doc.moveDown(0.25);
  }

  // --- Findings & solutions ---
  const actionable = sortBySeverity(r.findings);
  heading("Findings & Recommended Solutions");
  if (actionable.length === 0) {
    body("No findings were recorded for this scan — every check came back clear.", "#555");
  } else {
    actionable.forEach((f, i) => {
      subheading(`${i + 1}. ${f.title}`);
      doc.fontSize(8.5).fillColor(severityColor(f.severity)).text(`${f.severity.toUpperCase()}  ·  ${CHECK_LABELS[f.check]}`);
      doc.moveDown(0.1);
      if (f.detail) body(f.detail);
      if (f.evidence) {
        doc.fontSize(8.5).fillColor("#2563eb").text(f.evidence, { link: f.evidence, underline: true });
      }
      const solution = solutionFor(f);
      if (solution) {
        doc.moveDown(0.1);
        doc.fontSize(9).fillColor("#000").text("Solution:", { continued: false });
        if (solution.includes("\n")) {
          const [first, ...rest] = solution.split("\n");
          body(first);
          for (const line of rest) mono(line);
        } else {
          body(solution);
        }
      }
      doc.moveDown(0.5);
    });
  }

  doc.moveDown(0.3);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.3);
  doc
    .fontSize(8)
    .fillColor("#777")
    .text(
      "This report reflects a passive, non-destructive scan (one page load plus a small number of well-known-path GET requests). It is not a substitute for an authenticated security review or a certified penetration test."
    );

  doc.end();
  return done;
}

import type { DependencyFinding, Severity } from "./types";

interface ParsedPackage {
  name: string;
  version: string;
}

const FETCH_TIMEOUT_MS = 10000;
const UA = "LogMonitor-WebsiteSecurityAudit/1.0 (+authorized-scan)";

// Checked in priority order (lockfiles first — they give exact resolved versions rather
// than ranges). If a site accidentally serves one of these publicly (a real, if minor,
// info-disclosure issue in its own right), package/dependency checks run automatically
// against it instead of requiring an admin to paste a lockfile by hand.
const EXPOSED_MANIFEST_CANDIDATES = ["package-lock.json", "package.json", "composer.lock", "composer.json", "requirements.txt", "Gemfile.lock", "yarn.lock", "pnpm-lock.yaml"];

function looksLikeGenuineManifest(filename: string, content: string): boolean {
  const f = filename.toLowerCase();
  if (f.endsWith(".json")) {
    try {
      const parsed = JSON.parse(content);
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  }
  if (f === "requirements.txt") return /^[A-Za-z0-9_.-]+\s*==/m.test(content);
  if (f === "gemfile.lock") return /^GEM$/m.test(content) || /specs:/i.test(content);
  if (f === "yarn.lock") return /yarn lockfile v1|# yarn lockfile/i.test(content) || /^"?[^@"\s]+@/m.test(content);
  if (f === "pnpm-lock.yaml") return /^lockfileVersion/m.test(content);
  return content.trim().length > 0;
}

export interface ExposedManifest {
  filename: string;
  content: string;
}

// Safe existence-check GETs only, same convention as httpChecks.ts's SENSITIVE_PATHS scan —
// a 200 response with content that actually parses as that file format is the finding; the
// content itself is only ever used for the dependency-CVE lookup, never re-displayed raw.
export async function detectExposedManifest(baseUrl: string): Promise<ExposedManifest | null> {
  const u = new URL(baseUrl);
  for (const filename of EXPOSED_MANIFEST_CANDIDATES) {
    try {
      const res = await fetch(`${u.origin}/${filename}`, {
        redirect: "manual",
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { "User-Agent": UA },
      });
      if (res.status !== 200) continue;
      const content = await res.text();
      if (content.length > 2_000_000) continue;
      if (looksLikeGenuineManifest(filename, content)) return { filename, content };
    } catch {
      // unreachable — try the next candidate
    }
  }
  return null;
}

// Ecosystem names match OSV.dev's own vocabulary (https://ossf.github.io/osv-schema/#affectedpackage-field).
export function ecosystemForFilename(filename: string): string {
  const f = filename.toLowerCase();
  if (f === "package.json" || f === "package-lock.json" || f === "yarn.lock" || f === "pnpm-lock.yaml") return "npm";
  if (f === "composer.json" || f === "composer.lock") return "Packagist";
  if (f === "requirements.txt" || f === "pipfile" || f === "poetry.lock") return "PyPI";
  if (f === "gemfile" || f === "gemfile.lock") return "RubyGems";
  if (f === "pom.xml" || f === "build.gradle") return "Maven";
  if (f === "packages.config" || f.endsWith(".csproj") || f.includes("nuget")) return "NuGet";
  return "npm";
}

// Best-effort parsing per format — simple JSON/text/regex extraction, no new dependency
// needed (matches this codebase's existing manual-parsing style, e.g. mikrotikParser.ts).
// Where a manifest only lists a version *range* (package.json, requirements.txt with no
// pin) rather than a resolved exact version, the range's leading number is used as a
// best-effort stand-in — lockfiles (package-lock.json, composer.lock, Gemfile.lock) give
// exact resolved versions and are preferred when both are available.
export function parseLockfile(filename: string, content: string): ParsedPackage[] {
  const f = filename.toLowerCase();
  const packages: ParsedPackage[] = [];

  try {
    if (f === "package.json") {
      const json = JSON.parse(content);
      for (const section of ["dependencies", "devDependencies"]) {
        for (const [name, range] of Object.entries<string>(json[section] ?? {})) {
          packages.push({ name, version: String(range).replace(/^[\^~>=<\s]+/, "") });
        }
      }
    } else if (f === "package-lock.json") {
      const json = JSON.parse(content);
      if (json.packages) {
        for (const [key, value] of Object.entries<{ version?: string }>(json.packages)) {
          if (!key || key === "" || !value.version) continue;
          const name = key.replace(/^node_modules\//, "");
          if (name) packages.push({ name, version: value.version });
        }
      } else if (json.dependencies) {
        for (const [name, value] of Object.entries<{ version?: string }>(json.dependencies)) {
          if (value.version) packages.push({ name, version: value.version });
        }
      }
    } else if (f === "composer.json") {
      const json = JSON.parse(content);
      for (const [name, range] of Object.entries<string>(json.require ?? {})) {
        if (name === "php") continue;
        packages.push({ name, version: String(range).replace(/^[\^~>=<\s]+/, "") });
      }
    } else if (f === "composer.lock") {
      const json = JSON.parse(content);
      for (const pkg of [...(json.packages ?? []), ...(json["packages-dev"] ?? [])]) {
        if (pkg.name && pkg.version) packages.push({ name: pkg.name, version: String(pkg.version).replace(/^v/, "") });
      }
    } else if (f === "requirements.txt") {
      for (const line of content.split("\n")) {
        const m = /^([A-Za-z0-9_.-]+)\s*==\s*([A-Za-z0-9_.-]+)/.exec(line.trim());
        if (m) packages.push({ name: m[1], version: m[2] });
      }
    } else if (f === "gemfile.lock") {
      for (const m of content.matchAll(/^\s{4}([A-Za-z0-9_.-]+)\s+\(([\d.]+)\)/gm)) {
        packages.push({ name: m[1], version: m[2] });
      }
    } else if (f === "yarn.lock") {
      // yarn.lock isn't JSON/YAML-simple; a "name@range:\n  version \"x.y.z\"" block pattern
      // is regular enough for a best-effort line-pair extraction.
      const blocks = content.split(/\n\n/);
      for (const block of blocks) {
        const nameMatch = /^"?([^@"\s]+)@/.exec(block);
        const versionMatch = /version\s+"([^"]+)"/.exec(block);
        if (nameMatch && versionMatch) packages.push({ name: nameMatch[1], version: versionMatch[1] });
      }
    } else if (f === "pnpm-lock.yaml") {
      for (const m of content.matchAll(/^\s*\/?([^\s:/@]+)@([\d][\w.+-]*)\s*:/gm)) {
        packages.push({ name: m[1], version: m[2] });
      }
    } else if (f === "pom.xml") {
      for (const m of content.matchAll(/<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>/g)) {
        packages.push({ name: m[1], version: m[2] });
      }
    } else if (f === "packages.config" || f.endsWith(".csproj")) {
      for (const m of content.matchAll(/(?:id|Include)="([^"]+)"\s+version="([^"]+)"/gi)) {
        packages.push({ name: m[1], version: m[2] });
      }
    }
  } catch {
    return [];
  }

  return packages;
}

interface OsvVuln {
  id: string;
}
interface OsvBatchResponse {
  results: { vulns?: OsvVuln[] }[];
}

// OSV.dev is a free, public vulnerability database with no API key required — a safe,
// read-only lookup (we send package name + version, never any of the site's own data).
async function queryOsvBatch(ecosystem: string, packages: ParsedPackage[]): Promise<Map<number, string[]>> {
  const cveByIndex = new Map<number, string[]>();
  if (packages.length === 0) return cveByIndex;

  try {
    const res = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        queries: packages.map((p) => ({ package: { name: p.name, ecosystem }, version: p.version })),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return cveByIndex;
    const data = (await res.json()) as OsvBatchResponse;
    data.results.forEach((r, i) => {
      if (r.vulns && r.vulns.length > 0) cveByIndex.set(i, r.vulns.map((v) => v.id));
    });
  } catch {
    // OSV unreachable — dependency-CVE checks are best-effort and degrade gracefully
  }
  return cveByIndex;
}

const KNOWN_EOL_PACKAGES = new Set(["request", "moment", "istanbul", "left-pad", "tslint", "node-sass"]);

export async function runDependencyChecks(filename: string, content: string): Promise<DependencyFinding[]> {
  const ecosystem = ecosystemForFilename(filename);
  const packages = parseLockfile(filename, content);
  if (packages.length === 0) return [];

  const vulnsByIndex = await queryOsvBatch(ecosystem, packages);
  const findings: DependencyFinding[] = [];

  packages.forEach((pkg, i) => {
    const cveIds = vulnsByIndex.get(i);
    if (cveIds && cveIds.length > 0) {
      findings.push({
        packageName: pkg.name,
        currentVersion: pkg.version,
        recommendedVersion: null,
        ecosystem,
        severity: "critical" as Severity,
        cveIds: cveIds.join(", "),
        reason: "known_cve",
      });
    }
    if (KNOWN_EOL_PACKAGES.has(pkg.name)) {
      findings.push({
        packageName: pkg.name,
        currentVersion: pkg.version,
        recommendedVersion: null,
        ecosystem,
        severity: "medium" as Severity,
        cveIds: null,
        reason: "deprecated_or_abandoned",
      });
    }
  });

  return findings;
}

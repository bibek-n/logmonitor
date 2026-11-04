"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { isPhpVersionEol, isWordPressVersionOutdated, isNextJsVersionVulnerable } from "@/lib/websiteSecurityAudit/platformDetect";

// Row-action forms post a server action and wait for the full scan/DB round trip with no
// feedback in between, which reads as a frozen button. useFormStatus (react-dom) reports
// pending state for the nearest enclosing <form>, so this swaps in a spinner + "...ing" label
// and disables the button for exactly the duration of that form's submission.
function SubmitButton({
  pendingLabel,
  children,
  disabled,
  ...props
}: { pendingLabel: string } & ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <span className="btn-spinner" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </Button>
  );
}

// Same pending-state swap as SubmitButton, but for the toolbar's plain <button> elements
// (which carry custom inline styles rather than the shared Button component).
function PlainSubmitButton({
  pendingLabel,
  children,
  style,
  disabled,
  ...props
}: { pendingLabel: string; style?: CSSProperties } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      style={{ ...style, cursor: pending || disabled ? "default" : style?.cursor }}
      {...props}
    >
      {pending && <span className="btn-spinner" aria-hidden="true" />}
      {pending ? pendingLabel : children}
    </button>
  );
}

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
  Environment: string;
  CreatedAt: string;
  PhpVersion: string | null;
  PhpVersionCheckedAt: string | null;
  PhpVersionScanError: string | null;
  Platform: string | null;
  PlatformVersion: string | null;
  ServerHeader: string | null;
  PhpVersionManual: boolean;
  PlatformVersionManual: boolean;
}

// Suggestions only (free text is still accepted) - covers the platforms detectPlatform()
// can return plus the two this feature was built for (Next.js never discloses its version on
// the page itself, and WordPress's <meta generator> tag is often stripped by security plugins).
const PLATFORM_NAME_SUGGESTIONS = [
  "Next.js",
  "WordPress",
  "Laravel",
  "PHP",
  "React",
  "Express",
  "Angular",
  "Vue.js",
  "ASP.NET",
  ".NET Core",
  "Django",
  "Flask",
  "Python",
  "Ruby on Rails",
  "Spring Boot",
  "Node.js",
];
const PLATFORM_OTHER_OPTION = "__other__";

export const ENVIRONMENT_TONE: Record<string, { bg: string; fg: string }> = {
  Live: { bg: "var(--danger)", fg: "#fff" },
  Dev: { bg: "var(--warning)", fg: "#1a1a1a" },
  Staging: { bg: "var(--success)", fg: "#fff" },
};

const ENVIRONMENT_FILTERS = ["All", "Live", "Staging", "Dev"];

// Mirrors the page/pageSize pattern used by PatchesClient.tsx (IT Asset Logsheet) - this list
// loads every row up front (no server round-trip per page), so pagination here is just a
// client-side slice of the already-filtered array.
const PAGE_SIZE = 50;

// Matches the Badge component's tone palette (src/components/ui/Badge.tsx), not the
// status-good/warning/critical tones used by this page's own .stat-tile/.status-dot CSS -
// the two live side by side here (filter pills + Enabled dot keep the stat-tile tones,
// Environment/PHP Version cells use Badge) because each is matching a different sibling UI.
const ENVIRONMENT_BADGE_TONE: Record<string, BadgeTone> = {
  Live: "danger",
  Dev: "warning",
  Staging: "success",
};

// Mirrors exactly what the PHP Version cell shows (version / scan error / not detected / not
// scanned), so the filter dropdown's options and matching logic never drift from what's
// actually on screen.
function getPhpFilterValue(w: WebsiteRow): string {
  if (w.PhpVersion) return w.PhpVersion;
  if (w.PhpVersionScanError) return w.PhpVersionScanError;
  return w.PhpVersionCheckedAt ? "Not detected" : "Not scanned";
}

// Mirrors getPhpFilterValue's bucketing approach but groups by platform NAME only (not the
// version) - filtering to "every WordPress site" or "every Next.js site" is the useful
// grouping here, where filtering by exact version would fragment into too many one-off options.
function getPlatformFilterValue(w: WebsiteRow): string {
  if (w.Platform) return w.Platform;
  if (w.ServerHeader) return "Unknown (server header only)";
  return w.PhpVersionCheckedAt ? "Unknown" : "Not scanned";
}

// True when the detected Platform/PlatformVersion matches a known-vulnerable/outdated line -
// same red-blinking treatment as an EOL PHP version, just for the Platform column.
function isPlatformVersionVulnerable(w: WebsiteRow): boolean {
  if (!w.PlatformVersion) return false;
  if (w.Platform === "WordPress") return isWordPressVersionOutdated(w.PlatformVersion);
  if (w.Platform === "Next.js") return isNextJsVersionVulnerable(w.PlatformVersion);
  return false;
}

// True when this is a platform/version combination we actually run a vulnerability check
// against (WordPress, Next.js) and it passed - lets the badge go green the same way the PHP
// column does for a current version, instead of flatly gray for every platform regardless of
// whether anything was actually verified (a platform we don't check, like Laravel or .NET
// Core, has nothing to confirm "safe," so it stays neutral rather than falsely reading green).
function isPlatformVersionChecked(w: WebsiteRow): boolean {
  return (w.Platform === "WordPress" || w.Platform === "Next.js") && !!w.PlatformVersion;
}

interface WebsitesListClientProps {
  websites: WebsiteRow[];
  toggleWebsiteEnabled: (formData: FormData) => void;
  removeWebsite: (formData: FormData) => void;
  scanPhpVersion: (formData: FormData) => void;
  scanAllPhpVersions: () => void;
  scanSelectedPhpVersions: (formData: FormData) => void;
  setPhpVersionManually: (formData: FormData) => void;
  clearPhpVersionManualOverride: (formData: FormData) => void;
  setPlatformVersionManually: (formData: FormData) => void;
  clearPlatformVersionManualOverride: (formData: FormData) => void;
}

export function WebsitesListClient({
  websites,
  toggleWebsiteEnabled,
  removeWebsite,
  scanPhpVersion,
  scanAllPhpVersions,
  scanSelectedPhpVersions,
  setPhpVersionManually,
  clearPhpVersionManualOverride,
  setPlatformVersionManually,
  clearPlatformVersionManualOverride,
}: WebsitesListClientProps) {
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState("All");
  const [phpFilter, setPhpFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editingPhpId, setEditingPhpId] = useState<number | null>(null);
  const [phpInput, setPhpInput] = useState("");
  const [editingPlatformId, setEditingPlatformId] = useState<number | null>(null);
  const [platformNameInput, setPlatformNameInput] = useState("");
  const [platformVersionInput, setPlatformVersionInput] = useState("");
  const [page, setPage] = useState(1);

  const phpFilterOptions = useMemo(() => {
    const values = new Set(websites.map(getPhpFilterValue));
    return ["All", ...Array.from(values).sort()];
  }, [websites]);

  const platformFilterOptions = useMemo(() => {
    const values = new Set(websites.map(getPlatformFilterValue));
    return ["All", ...Array.from(values).sort()];
  }, [websites]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return websites.filter((w) => {
      if (envFilter !== "All" && w.Environment !== envFilter) return false;
      if (phpFilter !== "All" && getPhpFilterValue(w) !== phpFilter) return false;
      if (platformFilter !== "All" && getPlatformFilterValue(w) !== platformFilter) return false;
      if (!q) return true;
      return w.Name.toLowerCase().includes(q) || w.Url.toLowerCase().includes(q);
    });
  }, [websites, search, envFilter, phpFilter, platformFilter]);

  // A new search/filter can easily land the user past the last page of the new result set -
  // reset back to page 1 whenever the filtered set changes shape rather than show a blank page.
  useEffect(() => {
    setPage(1);
  }, [search, envFilter, phpFilter, platformFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  const allFilteredSelected = filtered.length > 0 && filtered.every((w) => selected.has(w.Id));

  // Mirrors the summary tile row other list pages show (e.g. the Staff page's Total/Online/
  // Offline tiles) - this page had the raw table with no at-a-glance summary above it.
  const stats = useMemo(() => {
    const enabled = websites.filter((w) => w.Enabled).length;
    const phpFound = websites.filter((w) => w.PhpVersion).length;
    const scanIssues = websites.filter((w) => w.PhpVersionScanError).length;
    return { total: websites.length, enabled, phpFound, scanIssues };
  }, [websites]);

  // Edit is a plain navigation (?edit=id), not a <button>, so it can't use the Button
  // component directly - this mirrors Button's secondary/sm look so it still reads as part
  // of the same row-action toolbar as the Scan/Set/Disable/Remove buttons next to it.
  const editLinkStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid var(--border)",
    background: "var(--surface-2)",
    color: "var(--ink)",
    borderRadius: 8,
    padding: "0.375rem 0.625rem",
    fontSize: "0.75rem",
    fontWeight: 500,
    marginRight: "0.4rem",
    textDecoration: "none",
  };

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((w) => next.delete(w.Id));
      } else {
        filtered.forEach((w) => next.add(w.Id));
      }
      return next;
    });
  }

  return (
    <>
      <div className="stat-grid">
        <div className="stat-tile status-unknown">
          <div className="label">
            <span className="status-dot status-unknown" />
            Total Websites
          </div>
          <div className="value">{stats.total}</div>
        </div>
        <div className="stat-tile status-good">
          <div className="label">
            <span className="status-dot status-good" />
            Enabled
          </div>
          <div className="value">{stats.enabled}</div>
        </div>
        <div className="stat-tile status-good">
          <div className="label">
            <span className="status-dot status-good" />
            PHP Version Found
          </div>
          <div className="value">{stats.phpFound}</div>
        </div>
        <div className="stat-tile status-warning">
          <div className="label">
            <span className="status-dot status-warning" />
            Scan Issues
          </div>
          <div className="value">{stats.scanIssues}</div>
        </div>
      </div>

      <div className="dash-panel">
      <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: "0.9rem" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or URL..."
          style={{
            flex: "1 1 260px",
            padding: "0.5rem 0.75rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "0.85rem",
          }}
        />
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENT_FILTERS.map((opt) => {
            const active = envFilter === opt;
            const tone = ENVIRONMENT_TONE[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setEnvFilter(opt)}
                style={{
                  padding: "0.35rem 0.85rem",
                  borderRadius: 999,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: active ? "none" : "1px solid var(--border)",
                  background: active ? (tone?.bg ?? "var(--ink)") : "transparent",
                  color: active ? (tone?.fg ?? "#fff") : "var(--ink-muted)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
        <select
          value={phpFilter}
          onChange={(e) => setPhpFilter(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "0.78rem",
          }}
          title="Filter by PHP version or scan status"
        >
          {phpFilterOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "All" ? "All PHP versions" : opt}
            </option>
          ))}
        </select>
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontSize: "0.78rem",
          }}
          title="Filter by platform"
        >
          {platformFilterOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === "All" ? "All platforms" : opt}
            </option>
          ))}
        </select>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          Showing {filtered.length} of {websites.length}
        </span>
        <form action={scanSelectedPhpVersions}>
          <input type="hidden" name="ids" value={Array.from(selected).join(",")} />
          <PlainSubmitButton
            pendingLabel="Scanning..."
            disabled={selected.size === 0}
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              color: selected.size === 0 ? "var(--ink-muted)" : "var(--ink)",
              borderRadius: 6,
              padding: "0.4rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: selected.size === 0 ? "default" : "pointer",
            }}
          >
            Scan Selected ({selected.size})
          </PlainSubmitButton>
        </form>
        <form action={scanAllPhpVersions}>
          <PlainSubmitButton
            pendingLabel="Scanning all sites..."
            style={{
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--ink)",
              borderRadius: 6,
              padding: "0.4rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Scan All PHP Versions
          </PlainSubmitButton>
        </form>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>{websites.length === 0 ? "No websites saved yet." : "No websites match your search/filter."}</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} title="Select all" />
              </th>
              <th style={{ padding: "0.5rem", width: "200px" }}>Name</th>
              <th style={{ padding: "0.5rem", width: "260px" }}>URL</th>
              <th style={{ padding: "0.5rem" }}>Environment</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>PHP Version</th>
              <th style={{ padding: "0.5rem" }}>Platform</th>
              <th style={{ padding: "0.5rem" }}>Added</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((w) => {
              const phpVulnerable = w.PhpVersion ? isPhpVersionEol(w.PhpVersion) : false;
              const platformVulnerable = isPlatformVersionVulnerable(w);
              const platformChecked = isPlatformVersionChecked(w);
              return (
              <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.5rem" }}>
                  <input type="checkbox" checked={selected.has(w.Id)} onChange={() => toggleOne(w.Id)} />
                </td>
                <td style={{ padding: "0.5rem", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={w.Name}>
                  {w.Name}
                </td>
                <td style={{ padding: "0.5rem", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <a href={w.Url} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }} title={w.Url}>
                    {w.Url}
                  </a>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <Badge
                    tone={ENVIRONMENT_BADGE_TONE[w.Environment] ?? "neutral"}
                    className={w.Environment === "Live" ? "disco-badge" : undefined}
                  >
                    {w.Environment}
                  </Badge>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span className={`status-dot status-${w.Enabled ? "good" : "unknown"}`} style={{ marginRight: "0.4rem" }} />
                  {w.Enabled ? "Enabled" : "Disabled"}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {editingPhpId === w.Id ? (
                    <form
                      action={setPhpVersionManually}
                      style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}
                      onSubmit={() => setEditingPhpId(null)}
                    >
                      <input type="hidden" name="id" value={w.Id} />
                      <input
                        type="text"
                        name="version"
                        value={phpInput}
                        onChange={(e) => setPhpInput(e.target.value)}
                        placeholder="e.g. 8.2.35"
                        autoFocus
                        style={{
                          width: "90px",
                          padding: "0.2rem 0.4rem",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          fontSize: "0.78rem",
                        }}
                      />
                      <SubmitButton pendingLabel="Saving..." variant="primary" size="sm">
                        Save
                      </SubmitButton>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPhpId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <>
                      {w.PhpVersion ? (
                        <span
                          title={
                            (w.PhpVersionManual ? "Entered manually, not auto-detected" : "Detected from the live X-Powered-By header") +
                            (phpVulnerable ? " - this version is end-of-life/vulnerable, upgrade recommended" : "")
                          }
                        >
                          <Badge tone={phpVulnerable ? "danger" : "success"} className={phpVulnerable ? "vuln-badge" : undefined}>
                            PHP {w.PhpVersion}
                            {w.PhpVersionManual ? " (manual)" : ""}
                          </Badge>
                        </span>
                      ) : w.PhpVersionScanError ? (
                        <span title="The scan couldn't reach the site - this isn't a confirmed 'no PHP detected,' just unknown.">
                          <Badge tone="warning">{w.PhpVersionScanError}</Badge>
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                          {w.PhpVersionCheckedAt ? "Not detected" : "Not scanned"}
                        </span>
                      )}
                      {w.PhpVersionCheckedAt && (
                        <div style={{ fontSize: "0.7rem", color: "var(--ink-muted)", marginTop: "0.2rem" }}>
                          Checked {new Date(w.PhpVersionCheckedAt).toLocaleString()}
                        </div>
                      )}
                    </>
                  )}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {editingPlatformId === w.Id ? (
                    <form
                      action={setPlatformVersionManually}
                      style={{ display: "flex", gap: "0.3rem", alignItems: "center", flexWrap: "wrap" }}
                      onSubmit={() => setEditingPlatformId(null)}
                    >
                      <input type="hidden" name="id" value={w.Id} />
                      <input type="hidden" name="platform" value={platformNameInput} />
                      <select
                        value={PLATFORM_NAME_SUGGESTIONS.includes(platformNameInput) ? platformNameInput : PLATFORM_OTHER_OPTION}
                        onChange={(e) => setPlatformNameInput(e.target.value === PLATFORM_OTHER_OPTION ? "" : e.target.value)}
                        autoFocus
                        style={{
                          width: "110px",
                          padding: "0.2rem 0.4rem",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          fontSize: "0.78rem",
                        }}
                      >
                        <option value={PLATFORM_OTHER_OPTION}>Other...</option>
                        {PLATFORM_NAME_SUGGESTIONS.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {!PLATFORM_NAME_SUGGESTIONS.includes(platformNameInput) && (
                        <input
                          type="text"
                          value={platformNameInput}
                          onChange={(e) => setPlatformNameInput(e.target.value)}
                          placeholder="Platform name"
                          style={{
                            width: "90px",
                            padding: "0.2rem 0.4rem",
                            borderRadius: 6,
                            border: "1px solid var(--border)",
                            background: "var(--surface)",
                            color: "var(--ink)",
                            fontSize: "0.78rem",
                          }}
                        />
                      )}
                      <input
                        type="text"
                        name="version"
                        value={platformVersionInput}
                        onChange={(e) => setPlatformVersionInput(e.target.value)}
                        placeholder="version (optional)"
                        style={{
                          width: "90px",
                          padding: "0.2rem 0.4rem",
                          borderRadius: 6,
                          border: "1px solid var(--border)",
                          background: "var(--surface)",
                          color: "var(--ink)",
                          fontSize: "0.78rem",
                        }}
                      />
                      <SubmitButton pendingLabel="Saving..." variant="primary" size="sm">
                        Save
                      </SubmitButton>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPlatformId(null)}>
                        Cancel
                      </Button>
                    </form>
                  ) : w.Platform ? (
                    <span
                      title={
                        (w.PlatformVersionManual ? "Entered manually, not auto-detected" : "Detected from the live page/headers") +
                        (platformVulnerable ? " - this version has a known vulnerability/is outdated, upgrade recommended" : "")
                      }
                    >
                      <Badge
                        tone={platformVulnerable ? "danger" : platformChecked ? "success" : "neutral"}
                        className={platformVulnerable ? "vuln-badge" : undefined}
                      >
                        {w.Platform}
                        {w.PlatformVersion ? ` ${w.PlatformVersion}` : ""}
                        {w.PlatformVersionManual ? " (manual)" : ""}
                      </Badge>
                      {w.ServerHeader && (
                        <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}> ({w.ServerHeader})</span>
                      )}
                    </span>
                  ) : w.ServerHeader ? (
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }} title="No app platform recognized - this is just the raw Server header">
                      {w.ServerHeader}
                    </span>
                  ) : (
                    <span style={{ color: "var(--ink-muted)", fontSize: "0.78rem" }}>
                      {w.PhpVersionCheckedAt ? "Unknown" : "Not scanned"}
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.5rem" }}>{new Date(w.CreatedAt).toLocaleString()}</td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                  <a href={`/dashboard/audit/websites?edit=${w.Id}`} style={editLinkStyle}>
                    Edit
                  </a>
                  <form action={scanPhpVersion} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={w.Id} />
                    <SubmitButton pendingLabel="Scanning..." variant="secondary" size="sm" style={{ marginRight: "0.4rem" }} title="Re-scan this site's PHP version, platform, and server header">
                      Scan
                    </SubmitButton>
                  </form>
                  {w.PhpVersionManual ? (
                    <form action={clearPhpVersionManualOverride} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={w.Id} />
                      <SubmitButton pendingLabel="Clearing..." variant="secondary" size="sm" style={{ marginRight: "0.4rem" }} title="Hand this row back to auto-detection">
                        Clear
                      </SubmitButton>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      style={{ marginRight: "0.4rem" }}
                      onClick={() => {
                        setEditingPhpId(w.Id);
                        setPhpInput(w.PhpVersion ?? "");
                      }}
                      title="Record a PHP version known from elsewhere (hosting panel, SSH, etc)"
                    >
                      Set
                    </Button>
                  )}
                  {w.PlatformVersionManual ? (
                    <form action={clearPlatformVersionManualOverride} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={w.Id} />
                      <SubmitButton pendingLabel="Clearing..." variant="secondary" size="sm" style={{ marginRight: "0.4rem" }} title="Hand the Platform/version back to auto-detection">
                        Clear Platform
                      </SubmitButton>
                    </form>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      style={{ marginRight: "0.4rem" }}
                      onClick={() => {
                        setEditingPlatformId(w.Id);
                        setPlatformNameInput(w.Platform ?? "");
                        setPlatformVersionInput(w.PlatformVersion ?? "");
                      }}
                      title="Record a platform + version known from elsewhere (e.g. Next.js from package.json, WordPress from wp-admin)"
                    >
                      Set Platform
                    </Button>
                  )}
                  <form action={toggleWebsiteEnabled} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={w.Id} />
                    <SubmitButton
                      pendingLabel={w.Enabled ? "Disabling..." : "Enabling..."}
                      variant="secondary"
                      size="sm"
                      style={{ marginRight: "0.4rem" }}
                    >
                      {w.Enabled ? "Disable" : "Enable"}
                    </SubmitButton>
                  </form>
                  <form action={removeWebsite} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={w.Id} />
                    <SubmitButton pendingLabel="Removing..." variant="danger" size="sm">
                      Remove
                    </SubmitButton>
                  </form>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
          <span>{filtered.length} site{filtered.length === 1 ? "" : "s"}</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span>
              Page {currentPage} of {totalPages}
            </span>
            <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

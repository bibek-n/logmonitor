"use client";

import { useMemo, useState } from "react";

export interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
  Environment: string;
  CreatedAt: string;
}

export const ENVIRONMENT_TONE: Record<string, { bg: string; fg: string }> = {
  Live: { bg: "var(--danger)", fg: "#fff" },
  Dev: { bg: "var(--warning)", fg: "#1a1a1a" },
  Staging: { bg: "var(--success)", fg: "#fff" },
};

const ENVIRONMENT_FILTERS = ["All", "Live", "Staging", "Dev"];

interface WebsitesListClientProps {
  websites: WebsiteRow[];
  toggleWebsiteEnabled: (formData: FormData) => void;
  removeWebsite: (formData: FormData) => void;
}

export function WebsitesListClient({ websites, toggleWebsiteEnabled, removeWebsite }: WebsitesListClientProps) {
  const [search, setSearch] = useState("");
  const [envFilter, setEnvFilter] = useState("All");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return websites.filter((w) => {
      if (envFilter !== "All" && w.Environment !== envFilter) return false;
      if (!q) return true;
      return w.Name.toLowerCase().includes(q) || w.Url.toLowerCase().includes(q);
    });
  }, [websites, search, envFilter]);

  return (
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
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          Showing {filtered.length} of {websites.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>{websites.length === 0 ? "No websites saved yet." : "No websites match your search/filter."}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}>Name</th>
              <th style={{ padding: "0.5rem" }}>URL</th>
              <th style={{ padding: "0.5rem" }}>Environment</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Added</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((w) => (
              <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.5rem" }}>{w.Name}</td>
                <td style={{ padding: "0.5rem" }}>
                  <a href={w.Url} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
                    {w.Url}
                  </a>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.15rem 0.6rem",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      background: (ENVIRONMENT_TONE[w.Environment] ?? ENVIRONMENT_TONE.Live).bg,
                      color: (ENVIRONMENT_TONE[w.Environment] ?? ENVIRONMENT_TONE.Live).fg,
                    }}
                  >
                    {w.Environment}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span className={`status-dot status-${w.Enabled ? "good" : "unknown"}`} style={{ marginRight: "0.4rem" }} />
                  {w.Enabled ? "Enabled" : "Disabled"}
                </td>
                <td style={{ padding: "0.5rem" }}>{new Date(w.CreatedAt).toLocaleString()}</td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                  <a
                    href={`/dashboard/audit/websites?edit=${w.Id}`}
                    style={{
                      display: "inline-block",
                      border: "1px solid var(--border)",
                      color: "var(--ink-muted)",
                      borderRadius: 6,
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.78rem",
                      marginRight: "0.4rem",
                      textDecoration: "none",
                    }}
                  >
                    Edit
                  </a>
                  <form action={toggleWebsiteEnabled} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={w.Id} />
                    <button
                      type="submit"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        color: "var(--ink-muted)",
                        borderRadius: 6,
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        marginRight: "0.4rem",
                      }}
                    >
                      {w.Enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={removeWebsite} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={w.Id} />
                    <button
                      type="submit"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        color: "var(--ink-muted)",
                        borderRadius: 6,
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

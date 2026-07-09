import { getDb } from "@/lib/db";
import { addWebsite, removeWebsite } from "./actions";

export const dynamic = "force-dynamic";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  CreatedAt: string;
}

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const db = await getDb();

  const result = await db.query<WebsiteRow>(`SELECT Id, Name, Url, CreatedAt FROM Websites ORDER BY Name`);
  const websites = result.recordset;

  return (
    <div>
      <h1>Websites</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Save websites here once, then quickly pick them from a dropdown on the Health Check, SSL Checker, Header
        Viewer, and GA Tag Finder pages instead of retyping the URL each time. All checks also work with any ad-hoc
        URL, saved or not.
      </p>

      {error && (
        <div
          style={{
            background: "var(--critical)",
            color: "#fff",
            padding: "0.6rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Add Website</h2>
        <form action={addWebsite} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required placeholder="e.g. Main Website" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
            <label htmlFor="url">URL</label>
            <input id="url" name="url" type="text" required placeholder="https://example.com" />
          </div>
          <button className="submit" type="submit" style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            Add
          </button>
        </form>
      </div>

      <div className="dash-panel">
        {websites.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No websites saved yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>URL</th>
                <th style={{ padding: "0.5rem" }}>Added</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {websites.map((w) => (
                <tr key={w.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>{w.Name}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <a href={w.Url} target="_blank" rel="noreferrer" style={{ color: "var(--series-1)" }}>
                      {w.Url}
                    </a>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{new Date(w.CreatedAt).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>
                    <form action={removeWebsite}>
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
    </div>
  );
}

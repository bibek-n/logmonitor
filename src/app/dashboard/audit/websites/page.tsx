import { getDb } from "@/lib/db";
import { addWebsite, removeWebsite, updateWebsite, toggleWebsiteEnabled } from "./actions";
import { EnvironmentSelect } from "@/components/websites/EnvironmentSelect";
import { WebsitesListClient, type WebsiteRow } from "@/components/websites/WebsitesListClient";

export const dynamic = "force-dynamic";

export default async function WebsitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const { error, edit } = await searchParams;
  const editId = edit ? Number(edit) : null;
  const db = await getDb();

  const result = await db.query<WebsiteRow>(`SELECT Id, Name, Url, Enabled, Environment, CreatedAt FROM Websites ORDER BY Name`);
  const websites = result.recordset;
  const editing = editId ? websites.find((w) => w.Id === editId) ?? null : null;

  return (
    <div>
      <h1>Websites</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Save websites here once, then quickly pick them from a dropdown on the Health Check, SSL Checker, Header
        Viewer, GA Tag Finder, and Website Security Audit pages instead of retyping the URL each time. All checks
        also work with any ad-hoc URL, saved or not. Disabling a website hides it from every one of those tools
        without deleting its saved history.
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
          <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
            <label htmlFor="environment">Environment</label>
            <EnvironmentSelect id="environment" defaultValue="Live" />
          </div>
          <button className="submit" type="submit" style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            Add
          </button>
        </form>
      </div>

      {editing && (
        <div className="dash-panel">
          <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Edit Website</h2>
          <form action={updateWebsite} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
            <input type="hidden" name="id" value={editing.Id} />
            <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
              <label htmlFor="edit-name">Name</label>
              <input id="edit-name" name="name" type="text" required defaultValue={editing.Name} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
              <label htmlFor="edit-url">URL</label>
              <input id="edit-url" name="url" type="text" required defaultValue={editing.Url} />
            </div>
            <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
              <label htmlFor="edit-environment">Environment</label>
              <EnvironmentSelect id="edit-environment" defaultValue={editing.Environment} />
            </div>
            <button className="submit" type="submit" style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
              Save
            </button>
            <a href="/dashboard/audit/websites" style={{ padding: "0.6rem 0", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
              Cancel
            </a>
          </form>
        </div>
      )}

      <WebsitesListClient websites={websites} toggleWebsiteEnabled={toggleWebsiteEnabled} removeWebsite={removeWebsite} />
    </div>
  );
}

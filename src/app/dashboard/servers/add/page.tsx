import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { AddServerForm } from "@/components/servers/AddServerForm";

export const dynamic = "force-dynamic";

export default async function AddServerPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Add Server</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can add servers.</p>
      </div>
    );
  }

  // Same reasoning as the Enroll Device page: the install command must use the company's
  // configured public URL, not whatever address happens to be in the admin's browser right now.
  const db = await getDb();
  const publicUrlResult = await db.query<{ PublicUrl: string | null }>`SELECT PublicUrl FROM CompanySettings WHERE Id = 1`;
  const configuredPublicUrl = publicUrlResult.recordset[0]?.PublicUrl ?? null;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Add Server</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Register a server, then install the agent using the command shown after saving — it will discover hardware and
        start shipping logs automatically.
      </p>
      <AddServerForm configuredPublicUrl={configuredPublicUrl} />
    </div>
  );
}

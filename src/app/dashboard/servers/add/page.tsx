import { getAdminSession } from "@/lib/requireAdmin";
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

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Add Server</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Register a server, then install the agent using the command shown after saving — it will discover hardware and
        start shipping logs automatically.
      </p>
      <AddServerForm />
    </div>
  );
}

import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export const dynamic = "force-dynamic";

export default async function RemoteDesktopPage() {
  const ra = await getRemoteAccessSession("ra_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Desktop</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Remote Access.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Desktop</h1>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>In-Browser RDP / VNC</h3>
          <Badge tone="warning">Coming in Phase 2</Badge>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", maxWidth: 640 }}>
          Real in-browser RDP/VNC rendering needs a dedicated protocol gateway (an Apache Guacamole-style
          <code> guacd</code> daemon or equivalent) — there is no drop-in library for this in the Node.js/npm
          ecosystem. Phase 1 ships connection metadata and reachability checks for RDP/VNC targets; the actual
          pixel-streaming viewer is a separate, larger build planned for Phase 2.
        </p>
      </Card>
    </div>
  );
}

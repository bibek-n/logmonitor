import { getAdminSession } from "@/lib/requireAdmin";
import { DiagramEditor } from "@/components/networkDiagramDesigner/DiagramEditor";

export const dynamic = "force-dynamic";

export default async function NewNetworkDiagramDesignPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Design New Diagram</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can design network diagrams.</p>
      </div>
    );
  }

  return <DiagramEditor mode="new" />;
}

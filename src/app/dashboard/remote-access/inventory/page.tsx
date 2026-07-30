import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { InventoryClient } from "@/components/remoteAccess/InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const ra = await getRemoteAccessSession("ra_view");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server Inventory</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Server Inventory.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Server Inventory</h1>
      <InventoryClient />
    </div>
  );
}

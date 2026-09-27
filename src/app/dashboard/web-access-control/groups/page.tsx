import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacGroupsClient } from "@/components/webAccessControl/GroupsClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlGroupsPage() {
  const wac = await getWebAccessControlSession("wac_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Staff Groups</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Web Access Control.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Staff Groups</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        A new grouping (Admin / Accounts / Sales / HR / General Staff) used only for website access rules - separate
        from the Roles used to control what an admin can do inside this dashboard. Built-in groups can be renamed but
        not deleted.
      </p>
      <WacGroupsClient />
    </div>
  );
}

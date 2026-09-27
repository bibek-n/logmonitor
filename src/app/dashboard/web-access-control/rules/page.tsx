import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacRulesClient } from "@/components/webAccessControl/RulesClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlRulesPage() {
  const wac = await getWebAccessControlSession("wac_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Website Rules</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Web Access Control.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Website Rules</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Allow/Block rules for a domain, scoped to a specific staff member, a Staff Group, or the whole company.
        Priority order: Critical Allowlist, then staff-level rules, then group-level rules, then a Global/default
        policy. Use &quot;Check Access&quot; below to preview what a staff member would experience for a domain
        before relying on a rule.
      </p>
      <WacRulesClient />
    </div>
  );
}

import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacAllowlistClient } from "@/components/webAccessControl/AllowlistClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlAllowlistPage() {
  const wac = await getWebAccessControlSession("wac_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Critical Application Allowlist</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Web Access Control.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Critical Application Allowlist</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Permanently-allowed business-critical services (domain, IP, or port) that always win over every other rule,
        for every staff member, regardless of any Block rule. Updating or removing an entry here always shows an
        explicit warning first.
      </p>
      <WacAllowlistClient />
    </div>
  );
}

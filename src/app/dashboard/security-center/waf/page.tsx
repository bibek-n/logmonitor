import { getSecurityCenterSession } from "@/lib/requireSecurityCenterPermission";
import { WafClient } from "@/components/securityCenter/WafClient";

export const dynamic = "force-dynamic";

export default async function WafPage() {
  const sc = await getSecurityCenterSession("sc_view");
  if (!sc) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Web Application Firewall</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view the WAF.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Web Application Firewall</h1>
      <WafClient />
    </div>
  );
}

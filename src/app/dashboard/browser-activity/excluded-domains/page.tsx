import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { listExcludedDomains } from "@/lib/browserActivity/repository";
import { ExcludedDomainsClient } from "@/components/browserActivity/ExcludedDomainsClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivityExcludedDomainsPage() {
  const ba = await getBrowserActivitySession("ba_view");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Excluded Domains</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view excluded domains.</p>
      </div>
    );
  }

  const domains = await listExcludedDomains();

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Excluded Domains</h1>
      <ExcludedDomainsClient domains={domains} />
    </div>
  );
}

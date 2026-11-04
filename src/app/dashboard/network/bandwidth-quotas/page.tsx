import { getAdminSession } from "@/lib/requireAdmin";
import { getBandwidthQuotaSettings, getBandwidthQuotaBreaches } from "@/lib/bandwidthQuota";
import { BandwidthQuotaClient } from "@/components/network/BandwidthQuotaClient";

export const dynamic = "force-dynamic";

export default async function BandwidthQuotasPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Bandwidth Quotas</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view this page.</p>
      </div>
    );
  }

  const settings = await getBandwidthQuotaSettings();
  const breaches = settings.enabled ? await getBandwidthQuotaBreaches(24) : [];

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Bandwidth Quotas</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Monitoring only — set a daily cap and see who would have been capped. Nothing here throttles or blocks anyone&apos;s traffic.
      </p>
      <BandwidthQuotaClient initialSettings={settings} initialBreaches={breaches} />
    </div>
  );
}

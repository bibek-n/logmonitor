import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { SslCertificatesClient } from "@/components/websiteApiMonitoring/SslCertificatesClient";

export const dynamic = "force-dynamic";

export default async function SslCertificatesPage() {
  const mon = await getMonitoringSession("mon_ssl_view");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>SSL Certificates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view SSL certificates.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>SSL Certificates</h1>
      <SslCertificatesClient />
    </div>
  );
}

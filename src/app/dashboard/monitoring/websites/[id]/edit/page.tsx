import { notFound } from "next/navigation";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { loadWebsiteMonitorById } from "@/lib/websiteApiMonitoring/repository";
import { WebsiteMonitorFormClient, WebsiteMonitorFormValues } from "@/components/websiteApiMonitoring/WebsiteMonitorFormClient";

export const dynamic = "force-dynamic";

export default async function EditWebsiteMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mon = await getMonitoringSession("mon_website_edit");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Edit Website Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to edit website monitors.</p>
      </div>
    );
  }

  const monitorId = Number(id);
  if (!Number.isInteger(monitorId)) notFound();
  const row = await loadWebsiteMonitorById(monitorId);
  if (!row) notFound();

  const initial: Partial<WebsiteMonitorFormValues> = {
    name: row.name,
    description: row.description ?? "",
    environment: row.environment ?? "Production",
    tags: row.tags.join(", "),
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    failureConfirmCount: row.failureConfirmCount,
    recoveryConfirmCount: row.recoveryConfirmCount,
    url: row.config.url,
    httpMethod: row.config.httpMethod,
    expectedStatusCode: row.config.expectedStatusCode,
    followRedirects: row.config.followRedirects,
    maxRedirects: row.config.maxRedirects,
    sslVerify: row.config.sslVerify,
    expectedKeyword: row.config.expectedKeyword ?? "",
    forbiddenKeyword: row.config.forbiddenKeyword ?? "",
    responseTimeWarningMs: row.config.responseTimeWarningMs,
    responseTimeCriticalMs: row.config.responseTimeCriticalMs,
    alertEmail: row.config.alertEmail ?? "",
    isActive: row.isActive,
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Edit Website Monitor</h1>
      <WebsiteMonitorFormClient monitorId={monitorId} initial={initial} />
    </div>
  );
}

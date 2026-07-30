import { notFound } from "next/navigation";
import { getMonitoringSession } from "@/lib/requireMonitoringPermission";
import { loadApiMonitorById } from "@/lib/websiteApiMonitoring/repository";
import { maskApiAuthConfig } from "@/lib/websiteApiMonitoring/apiCredentials";
import { ApiMonitorFormClient, ApiMonitorFormValues } from "@/components/websiteApiMonitoring/ApiMonitorFormClient";

export const dynamic = "force-dynamic";

export default async function EditApiMonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mon = await getMonitoringSession("mon_api_edit");
  if (!mon) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Edit API Monitor</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to edit API monitors.</p>
      </div>
    );
  }

  const monitorId = Number(id);
  if (!Number.isInteger(monitorId)) notFound();
  const row = await loadApiMonitorById(monitorId);
  if (!row) notFound();

  // Never pass a decrypted secret into a Server Component's rendered output - masked exactly
  // like the GET /api/admin/monitoring/api/[id] route does for the same reason.
  const authConfig = maskApiAuthConfig(row.config.authConfig);

  const initial: Partial<ApiMonitorFormValues> = {
    name: row.name,
    description: row.description ?? "",
    environment: row.environment ?? "Production",
    tags: row.tags.join(", "),
    intervalSeconds: row.intervalSeconds,
    timeoutMs: row.timeoutMs,
    failureConfirmCount: row.failureConfirmCount,
    recoveryConfirmCount: row.recoveryConfirmCount,
    isActive: row.isActive,
    url: row.config.url,
    httpMethod: row.config.httpMethod,
    headers: row.config.headers,
    queryParams: row.config.queryParams,
    requestBody: row.config.requestBody ?? "",
    requestBodyContentType: row.config.requestBodyContentType ?? "application/json",
    authType: row.config.authType,
    keyLocation: authConfig.type === "ApiKey" ? authConfig.keyLocation : "header",
    keyName: authConfig.type === "ApiKey" ? authConfig.keyName : "",
    keyValue: authConfig.type === "ApiKey" ? authConfig.keyValue : "",
    token: authConfig.type === "BearerToken" ? authConfig.token : "",
    username: authConfig.type === "BasicAuth" ? authConfig.username : "",
    password: authConfig.type === "BasicAuth" ? authConfig.password : "",
    tokenUrl: authConfig.type === "OAuth2ClientCredentials" ? authConfig.tokenUrl : "",
    clientId: authConfig.type === "OAuth2ClientCredentials" ? authConfig.clientId : "",
    clientSecret: authConfig.type === "OAuth2ClientCredentials" ? authConfig.clientSecret : "",
    scope: authConfig.type === "OAuth2ClientCredentials" ? authConfig.scope ?? "" : "",
    expectedStatusCode: row.config.expectedStatusCode,
    followRedirects: row.config.followRedirects,
    maxRedirects: row.config.maxRedirects,
    sslVerify: row.config.sslVerify,
    assertions: row.config.assertions.map((a) => ({ path: a.path, operator: a.operator, expectedValue: a.expectedValue ?? "" })),
    responseTimeWarningMs: row.config.responseTimeWarningMs,
    responseTimeCriticalMs: row.config.responseTimeCriticalMs,
    alertEmail: row.config.alertEmail ?? "",
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Edit API Monitor</h1>
      <ApiMonitorFormClient monitorId={monitorId} initial={initial} />
    </div>
  );
}

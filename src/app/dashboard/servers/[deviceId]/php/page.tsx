import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { ServerDetailTabs } from "@/components/servers/ServerDetailTabs";
import { PhpVersionsClient, type PhpVersionRow } from "@/components/servers/PhpVersionsClient";

export const dynamic = "force-dynamic";

export default async function ServerPhpPage({ params }: { params: Promise<{ deviceId: string }> }) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Server PHP</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view server details.</p>
      </div>
    );
  }

  const { deviceId } = await params;
  const db = await getDb();

  const deviceResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<{
    DeviceName: string | null;
    Hostname: string;
    OS: string | null;
    PhpDetected: boolean;
    LastPhpCheckAt: string | null;
  }>(`
    SELECT DeviceName, Hostname, OS, PhpDetected, CONVERT(VARCHAR(19), LastPhpCheckAt, 126) AS LastPhpCheckAt
    FROM Devices WHERE DeviceId = @deviceId AND DeviceType = 'Server'
  `);
  const device = deviceResult.recordset[0];
  if (!device) notFound();
  const isLinux = device.OS?.toLowerCase() === "linux";

  const versionsResult = await db.request().input("deviceId", sql.VarChar, deviceId).query<PhpVersionRow>(`
    SELECT Version, SapiCli, SapiFpm, CliErrorLogPath, FpmErrorLogPath, IsDefault
    FROM PhpVersions WHERE DeviceId = @deviceId ORDER BY Version ASC
  `);

  const mssqlLogCountResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ Total: number }>("SELECT COUNT(*) AS Total FROM ServerLogEntries WHERE DeviceId = @deviceId AND LogSource IN ('mssql', 'mssql_slow')");
  const logCountResult = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM ServerLogEntries WHERE DeviceId = @deviceId");

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>PHP — {device.DeviceName ?? device.Hostname}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.75rem" }}>
        Installed PHP versions and their FPM/CLI error logs, read directly from this server.
      </p>

      <ServerDetailTabs
        deviceId={deviceId}
        active="php"
        logCount={logCountResult.recordset[0]?.Cnt ?? 0}
        mssqlLogCount={mssqlLogCountResult.recordset[0]?.Total ?? 0}
        showPhpTab={isLinux}
      />

      {!isLinux ? (
        <p style={{ color: "var(--ink-muted)" }}>PHP version detection only runs on Linux servers.</p>
      ) : !device.PhpDetected ? (
        <p style={{ color: "var(--ink-muted)" }}>
          {device.LastPhpCheckAt
            ? "No PHP installation detected on this server."
            : "Waiting for the agent's first check-in - this can take up to 15 minutes after enrollment."}
        </p>
      ) : (
        <PhpVersionsClient deviceId={deviceId} versions={versionsResult.recordset} />
      )}
    </div>
  );
}

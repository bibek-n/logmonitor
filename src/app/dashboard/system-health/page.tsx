import { getDb, sql } from "@/lib/db";
import BandwidthChart, { kbitsToMbps } from "@/components/BandwidthChart";

export const dynamic = "force-dynamic";

interface HealthRow {
  Id: number;
  ReceivedAt: string;
  DeviceName: string | null;
  LogComponent: string | null;
  Fields: string | null;
}

interface BandwidthRow {
  ReceivedAt: string;
  Rx: string | null;
  Tx: string | null;
}

const COMPONENT_ORDER = ["CPU", "Memory", "Disk", "Interface", "Live User", "SSL"];

// Fields we don't need to show separately since they're already displayed elsewhere.
const HIDDEN_KEYS = new Set([
  "date",
  "time",
  "timestamp",
  "timezone",
  "device_name",
  "device_id",
  "device_model",
  "device_serial_id",
  "log_id",
  "log_type",
  "log_component",
  "log_subtype",
  "log_version",
  "severity",
  "priority",
]);

function formatFields(json: string | null): { key: string; value: string }[] {
  if (!json) return [];
  try {
    const obj = JSON.parse(json) as Record<string, string>;
    return Object.entries(obj)
      .filter(([k, v]) => !HIDDEN_KEYS.has(k) && v !== "")
      .map(([key, value]) => ({ key, value }));
  } catch {
    return [];
  }
}

function bytesToGB(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return n / 1024 ** 3;
}

function parsePercent(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v.replace("%", ""));
  return Number.isNaN(n) ? null : n;
}

function parseJson(json: string | null): Record<string, string> {
  if (!json) return {};
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

// Only these physical interfaces are shown, labeled with their real-world role. Port1 is
// confirmed as the LAN/intranet uplink by the Sophos device's own syslog data (it sends
// "display_interface":"INTRANET" for Port1 specifically — no other port has a custom alias).
const INTERFACE_LABELS: Record<string, string> = {
  Port1: "Intranet",
  Port2: "WLAN",
};

export default async function SystemHealthPage() {
  const db = await getDb();
  const result = await db.query<HealthRow>(`
    SELECT Id, ReceivedAt, DeviceName, LogComponent, Fields
    FROM SystemHealthLogs
    WHERE Id IN (
      SELECT MAX(Id)
      FROM SystemHealthLogs
      GROUP BY LogComponent, DeviceName, JSON_VALUE(Fields, '$.interface')
    )
    ORDER BY LogComponent, JSON_VALUE(Fields, '$.interface')
  `);

  const wlanHistoryResult = await db
    .request()
    .input("ifName", sql.NVarChar, "Port2")
    .query<BandwidthRow>(`
      SELECT TOP 50 ReceivedAt,
        JSON_VALUE(Fields, '$.receivedkbits') AS Rx,
        JSON_VALUE(Fields, '$.transmittedkbits') AS Tx
      FROM SystemHealthLogs
      WHERE LogComponent = 'Interface' AND JSON_VALUE(Fields, '$.interface') = @ifName
      ORDER BY ReceivedAt DESC
    `);

  const wlanPoints = wlanHistoryResult.recordset
    .filter((r) => r.Rx !== null && r.Tx !== null)
    .map((r) => ({
      t: r.ReceivedAt,
      rx: kbitsToMbps(Number(r.Rx)),
      tx: kbitsToMbps(Number(r.Tx)),
    }))
    .reverse();

  const intranetHistoryResult = await db
    .request()
    .input("ifName", sql.NVarChar, "Port1")
    .query<BandwidthRow>(`
      SELECT TOP 50 ReceivedAt,
        JSON_VALUE(Fields, '$.receivedkbits') AS Rx,
        JSON_VALUE(Fields, '$.transmittedkbits') AS Tx
      FROM SystemHealthLogs
      WHERE LogComponent = 'Interface' AND JSON_VALUE(Fields, '$.interface') = @ifName
      ORDER BY ReceivedAt DESC
    `);

  const intranetPoints = intranetHistoryResult.recordset
    .filter((r) => r.Rx !== null && r.Tx !== null)
    .map((r) => ({
      t: r.ReceivedAt,
      rx: kbitsToMbps(Number(r.Rx)),
      tx: kbitsToMbps(Number(r.Tx)),
    }))
    .reverse();

  const latestByComponent = new Map<string, HealthRow[]>();
  for (const row of result.recordset) {
    const key = row.LogComponent ?? "Unknown";
    if (key === "Interface") {
      const ifName = parseJson(row.Fields).interface;
      if (!ifName || !(ifName in INTERFACE_LABELS)) continue;
    }
    if (!latestByComponent.has(key)) latestByComponent.set(key, []);
    latestByComponent.get(key)!.push(row);
  }

  const components = [
    ...COMPONENT_ORDER.filter((c) => latestByComponent.has(c)),
    ...[...latestByComponent.keys()].filter((c) => !COMPONENT_ORDER.includes(c)),
  ];

  return (
    <div>
      <h1>Sophos System Health — Usage</h1>

      {components.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>
          No System Health events received yet. Waiting for Sophos syslog data on port 5514.
        </p>
      ) : (
        components.map((component) => (
          <div key={component} className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem", marginTop: 0 }}>{component}</h2>
            {component === "Disk" && (
              <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.5rem" }}>
                Sophos reports disk usage as % of partition capacity only — it doesn&apos;t
                include total partition size, so GB values aren&apos;t available here.
              </p>
            )}
            {latestByComponent.get(component)!.map((row) => {
              const fields = parseJson(row.Fields);
              const isMemory = component === "Memory";
              const isCpu = component === "CPU";
              const isWlan = component === "Interface" && fields.interface === "Port2";
              const isIntranet = component === "Interface" && fields.interface === "Port1";

              const totalGB = isMemory ? bytesToGB(fields.total_memory) : null;
              const usedGB = isMemory ? bytesToGB(fields.used) : null;
              const freeGB = isMemory ? bytesToGB(fields.free) : null;
              const usedPct =
                totalGB && usedGB !== null ? ((usedGB / totalGB) * 100).toFixed(1) : null;

              const cpuSystem = isCpu ? parsePercent(fields.system) : null;
              const cpuUser = isCpu ? parsePercent(fields.user) : null;
              const cpuIdle = isCpu ? parsePercent(fields.idle) : null;
              const cpuUsage = cpuIdle !== null ? (100 - cpuIdle).toFixed(1) : null;

              return (
                <div
                  key={row.Id}
                  style={{
                    background: "var(--plane)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "0.75rem",
                    marginBottom: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  <div style={{ color: "var(--ink-secondary)", marginBottom: "0.35rem" }}>
                    {component === "Interface" && fields.interface && (
                      <strong style={{ color: "var(--ink)" }}>
                        {INTERFACE_LABELS[fields.interface]} ({fields.interface}){" "}
                      </strong>
                    )}
                    {row.DeviceName ?? "Unknown device"} &middot;{" "}
                    {new Date(row.ReceivedAt).toLocaleString()}
                  </div>

                  {isMemory && totalGB !== null && usedGB !== null && freeGB !== null ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>Total:</span> {totalGB.toFixed(2)} GB
                      </span>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>Used:</span> {usedGB.toFixed(2)} GB
                        {usedPct ? ` (${usedPct}%)` : ""}
                      </span>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>Free:</span> {freeGB.toFixed(2)} GB
                      </span>
                    </div>
                  ) : isCpu && cpuUsage !== null ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>Usage:</span> {cpuUsage}%
                      </span>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>System:</span> {cpuSystem}%
                      </span>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>User:</span> {cpuUser}%
                      </span>
                      <span>
                        <span style={{ color: "var(--ink-muted)" }}>Idle:</span> {cpuIdle}%
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      {formatFields(row.Fields).map((f) => (
                        <span key={f.key}>
                          <span style={{ color: "var(--ink-muted)" }}>{f.key}:</span> {f.value}
                        </span>
                      ))}
                    </div>
                  )}

                  {isWlan && <BandwidthChart points={wlanPoints} unit="Mbps" />}
                  {isIntranet && <BandwidthChart points={intranetPoints} unit="Mbps" />}
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}

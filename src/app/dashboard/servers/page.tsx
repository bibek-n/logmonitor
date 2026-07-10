import Link from "next/link";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

interface ServerRow {
  DeviceId: string;
  DeviceName: string | null;
  Hostname: string;
  StaticIpAddress: string | null;
  LastIp: string | null;
  ServerRole: string | null;
  OS: string;
  LifecycleStatus: string;
  MacAddress: string | null;
  LastHeartbeat: string | null;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Active: "success",
  Pending: "neutral",
  Maintenance: "warning",
  Decommissioned: "danger",
};

function isOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 5 * 60 * 1000;
}

export default async function ServersPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Servers</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view servers.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<ServerRow>`
    SELECT DeviceId, DeviceName, Hostname, StaticIpAddress, LastIp, ServerRole, OS, LifecycleStatus, MacAddress,
      CONVERT(VARCHAR(19), LastHeartbeat, 126) AS LastHeartbeat
    FROM Devices
    WHERE DeviceType = 'Server'
    ORDER BY DeviceName ASC, Hostname ASC
  `;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Servers</h1>
        <Link href="/dashboard/servers/add">
          <Button size="sm">
            <Plus size={14} /> Add Server
          </Button>
        </Link>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Registered servers with agent-collected hardware and log data.
      </p>

      <Card style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Device Name", "Hostname", "IP Address", "Role", "OS", "MAC Address", "Status", "Connectivity"].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.9rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.recordset.map((s) => (
                <tr key={s.DeviceId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Link href={`/dashboard/servers/${s.DeviceId}`} style={{ color: "var(--primary)" }}>
                      {s.DeviceName || s.Hostname || "(unnamed)"}
                    </Link>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", color: s.Hostname ? undefined : "var(--ink-muted)" }}>
                    {s.Hostname || "Pending enrollment"}
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{s.StaticIpAddress ?? s.LastIp ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{s.ServerRole ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem", textTransform: "capitalize" }}>{s.OS}</td>
                  <td style={{ padding: "0.6rem 0.9rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.MacAddress ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={STATUS_TONE[s.LifecycleStatus] ?? "neutral"}>{s.LifecycleStatus}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={isOnline(s.LastHeartbeat) ? "success" : "neutral"}>{isOnline(s.LastHeartbeat) ? "Online" : "Offline"}</Badge>
                  </td>
                </tr>
              ))}
              {result.recordset.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No servers registered yet — click "Add Server" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { DeviceGrid, type DeviceRow } from "@/components/endpointAgents/DeviceGrid";

export const dynamic = "force-dynamic";

interface DeviceQueryRow {
  DeviceId: string;
  Hostname: string;
  LastIp: string | null;
  MacAddress: string | null;
  StaffId: number | null;
  StaffName: string | null;
}

export default async function EndpointAgentsPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Endpoint Agents</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view endpoint agent data.</p>
      </div>
    );
  }

  const db = await getDb();

  const result = await db.query<DeviceQueryRow>(`
    SELECT d.DeviceId, d.Hostname, d.LastIp, d.MacAddress, d.StaffId, s.Name AS StaffName
    FROM Devices d
    LEFT JOIN Staff s ON s.Id = d.StaffId
    ORDER BY d.Hostname
  `);

  const devices: DeviceRow[] = result.recordset.map((r) => ({
    deviceId: r.DeviceId,
    hostname: r.Hostname,
    staffName: r.StaffName,
    lastIp: r.LastIp,
    macAddress: r.MacAddress,
  }));

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Endpoint Agents</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Devices enrolled with the Tulips Unified Admin Center endpoint agent.
      </p>
      <DeviceGrid devices={devices} />
    </div>
  );
}

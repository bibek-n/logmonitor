import Link from "next/link";
import { getDb } from "@/lib/db";
import { getAdminSession } from "@/lib/requireAdmin";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import { ServersTable } from "@/components/servers/ServersTable";

export const dynamic = "force-dynamic";

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
  const result = await db.query`
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

      <ServersTable servers={result.recordset} />
    </div>
  );
}

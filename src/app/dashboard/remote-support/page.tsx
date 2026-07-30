import { getDb } from "@/lib/db";
import { getRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { isDeviceOnline } from "@/lib/remoteSupport/presence";
import { RemoteSupportConsole, type RemoteSupportDevice } from "@/components/remoteSupport/RemoteSupportConsole";

export const dynamic = "force-dynamic";

interface DeviceRow {
  DeviceId: string;
  Hostname: string;
  Department: string | null;
  StaffId: number | null;
  StaffName: string | null;
  LastHeartbeat: string | null;
  ActiveSessionStatus: string | null;
  ActiveSessionId: number | null;
}

export default async function RemoteSupportPage() {
  const rs = await getRemoteSupportSession("remote_support_request");
  if (!rs) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Support</h1>
        <p style={{ color: "var(--danger)" }}>
          You don&apos;t have access to Remote Support, or your account needs two-factor authentication enabled
          first (Settings → Security) - this module requires it for every session request.
        </p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<DeviceRow>`
    SELECT d.DeviceId, d.Hostname, d.Department, d.StaffId, s.Name AS StaffName, d.LastHeartbeat,
      (SELECT TOP 1 Status FROM RemoteSupportSessions rss
        WHERE rss.DeviceId = d.DeviceId AND rss.Status IN ('Pending','Approved','Active')
        ORDER BY rss.Id DESC) AS ActiveSessionStatus,
      (SELECT TOP 1 Id FROM RemoteSupportSessions rss
        WHERE rss.DeviceId = d.DeviceId AND rss.Status IN ('Pending','Approved','Active')
        ORDER BY rss.Id DESC) AS ActiveSessionId
    FROM Devices d
    LEFT JOIN Staff s ON s.Id = d.StaffId
    ORDER BY d.Hostname ASC
  `;

  const devices: RemoteSupportDevice[] = result.recordset.map((row) => {
    const online = isDeviceOnline(row.LastHeartbeat);
    const status: RemoteSupportDevice["status"] = !online ? "Offline" : row.ActiveSessionStatus ? "InSession" : "Online";
    return {
      deviceId: row.DeviceId,
      hostname: row.Hostname,
      department: row.Department,
      staffId: row.StaffId,
      staffName: row.StaffName,
      status,
      activeSessionId: row.ActiveSessionId,
    };
  });

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.25rem" }}>Remote Support</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Request a consent-based screen view/control session with an employee&apos;s device. Nothing is shared until
        they explicitly approve.
      </p>

      <RemoteSupportConsole initialDevices={devices} />
    </div>
  );
}

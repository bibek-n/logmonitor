import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, sql } from "@/lib/db";
import { parseRouterDurationToSeconds } from "@/lib/mikrotikParser";
import { classifyDevice } from "@/lib/deviceType";
import { formatDuration } from "@/lib/staffStatus";
import { Avatar } from "@/components/ui/Avatar";

export const dynamic = "force-dynamic";

interface StaffRow {
  Id: number;
  Name: string;
  MacAddress: string | null;
  Email: string | null;
  Phone: string | null;
  Department: string | null;
  Position: string | null;
  Address: string | null;
  PhotoPath: string | null;
  RouterIp: string | null;
  Hostname: string | null;
  Status: string | null;
  LastSeenRaw: string | null;
  RouterUpdatedAt: string | null;
  Os: string | null;
  RouterFirstSeen: string | null;
  SophosIp: string | null;
  SophosUpdatedAt: string | null;
  SophosHostname: string | null;
  SophosOs: string | null;
  SophosFirstSeen: string | null;
  VendorName: string | null;
}

interface LinkedDevice {
  DeviceId: string;
  Hostname: string;
  OS: string;
  LastHeartbeat: string | null;
}

interface HistoricalIp {
  IpAddress: string;
  Source: "mikrotik" | "sophos";
  UpdatedAt: string;
}

function isPollFresh(updatedAt: string | null, staleMinutes = 10): boolean {
  if (!updatedAt) return false;
  return Date.now() - new Date(updatedAt).getTime() <= staleMinutes * 60 * 1000;
}

function lastSeenAt(updatedAt: string | null, lastSeenRaw: string | null): Date | null {
  if (!updatedAt) return null;
  const seconds = parseRouterDurationToSeconds(lastSeenRaw);
  if (seconds === null) return null;
  return new Date(new Date(updatedAt).getTime() - seconds * 1000);
}

interface WebFilterRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  Domain: string | null;
  Url: string | null;
  Category: string | null;
  Action: string | null;
}

interface RouterWebRow {
  Id: number;
  ReceivedAt: string;
  SrcIp: string;
  DstIp: string | null;
  DstPort: number | null;
  ReverseDns: string | null;
}

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staffId = Number(id);
  if (!staffId) notFound();

  const db = await getDb();

  const staffResult = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<StaffRow>(`
      SELECT s.Id, s.Name, s.MacAddress, s.Email, s.Phone, s.Department, s.Position, s.Address, s.PhotoPath,
        best.IpAddress AS RouterIp, best.Hostname, best.Status, best.LastSeenRaw, best.UpdatedAt AS RouterUpdatedAt, best.Os,
        best.FirstSeen AS RouterFirstSeen,
        sophosBest.IpAddress AS SophosIp, sophosBest.UpdatedAt AS SophosUpdatedAt, sophosBest.Hostname AS SophosHostname,
        sophosBest.Os AS SophosOs, sophosBest.FirstSeen AS SophosFirstSeen,
        ov.VendorName
      FROM Staff s
      OUTER APPLY (
        SELECT TOP 1 IpAddress, Hostname, Status, LastSeenRaw, UpdatedAt, Os, FirstSeen
        FROM RouterClients rc WHERE UPPER(rc.MacAddress) = UPPER(s.MacAddress)
        ORDER BY UpdatedAt DESC
      ) best
      OUTER APPLY (
        SELECT TOP 1 IpAddress, UpdatedAt, Hostname, Os, FirstSeen
        FROM SophosClients sc WHERE UPPER(sc.MacAddress) = UPPER(s.MacAddress)
        ORDER BY UpdatedAt DESC
      ) sophosBest
      LEFT JOIN OuiVendors ov ON ov.Prefix = REPLACE(LEFT(s.MacAddress, 8), ':', '')
      WHERE s.Id = @id
    `);

  const staffMember = staffResult.recordset[0];
  if (!staffMember) notFound();

  const routerTime = staffMember.RouterIp && staffMember.RouterUpdatedAt ? new Date(staffMember.RouterUpdatedAt).getTime() : -Infinity;
  const sophosTime = staffMember.SophosIp && staffMember.SophosUpdatedAt ? new Date(staffMember.SophosUpdatedAt).getTime() : -Infinity;
  const source: "mikrotik" | "sophos" | null =
    routerTime === -Infinity && sophosTime === -Infinity ? null : routerTime >= sophosTime ? "mikrotik" : "sophos";
  const currentIp = source === "mikrotik" ? staffMember.RouterIp : source === "sophos" ? staffMember.SophosIp : null;
  const deviceName = source === "mikrotik" ? staffMember.Hostname : source === "sophos" ? staffMember.SophosHostname : null;
  const os = source === "mikrotik" ? staffMember.Os : source === "sophos" ? staffMember.SophosOs : null;
  const firstSeenRaw = source === "mikrotik" ? staffMember.RouterFirstSeen : source === "sophos" ? staffMember.SophosFirstSeen : null;
  const firstSeen = firstSeenRaw ? new Date(firstSeenRaw) : null;
  const deviceType = classifyDevice(deviceName, staffMember.VendorName);

  let isOnline = false;
  if (source === "mikrotik") {
    isOnline = !!staffMember.MacAddress && staffMember.Status === "bound" && isPollFresh(staffMember.RouterUpdatedAt);
  } else if (source === "sophos" && currentIp) {
    const activeResult = await db
      .request()
      .input("ip", sql.VarChar, currentIp)
      .query<{ Cnt: number }>(`
        SELECT COUNT(*) AS Cnt FROM WebFilterLogs WHERE SrcIp = @ip AND ReceivedAt >= DATEADD(MINUTE, -10, SYSUTCDATETIME())
      `);
    isOnline = activeResult.recordset[0].Cnt > 0;
  }

  // Reverse-lookup of the existing, already-working Devices.StaffId link (set from the
  // Endpoint Agents device's own "Assigned staff member" field) — surfaced here purely for
  // visibility, not re-editable from this page, so there's only one place that writes it.
  const linkedDeviceResult = await db
    .request()
    .input("id", sql.Int, staffId)
    .query<LinkedDevice>(
      "SELECT DeviceId, Hostname, OS, LastHeartbeat FROM Devices WHERE StaffId = @id"
    );
  const linkedDevice = linkedDeviceResult.recordset[0] ?? null;

  const statusColor = !staffMember.MacAddress ? "unknown" : isOnline ? "good" : "warning";
  // MikroTik gives a precise "last seen X ago" from the lease; Sophos-side only tells us the
  // device was still in the firewall's ARP table as of its last poll — coarser, still useful.
  const seenAt =
    source === "mikrotik"
      ? lastSeenAt(staffMember.RouterUpdatedAt, staffMember.LastSeenRaw)
      : source === "sophos" && staffMember.SophosUpdatedAt
        ? new Date(staffMember.SophosUpdatedAt)
        : null;

  // Every IP this MAC has ever held, on either network — so the activity report below covers
  // the full history, not just whatever the device's IP happens to be right now.
  let historicalIps: HistoricalIp[] = [];
  if (staffMember.MacAddress) {
    const historyResult = await db
      .request()
      .input("mac", sql.VarChar, staffMember.MacAddress)
      .query<HistoricalIp>(`
        SELECT IpAddress, 'mikrotik' AS Source, UpdatedAt
        FROM RouterClients WHERE UPPER(MacAddress) = UPPER(@mac)
        UNION ALL
        SELECT IpAddress, 'sophos' AS Source, UpdatedAt
        FROM SophosClients WHERE UPPER(MacAddress) = UPPER(@mac)
        ORDER BY UpdatedAt DESC
      `);
    historicalIps = historyResult.recordset;
  }
  const allIps = [...new Set(historicalIps.map((h) => h.IpAddress))];

  let webFilterRows: WebFilterRow[] = [];
  let routerWebRows: RouterWebRow[] = [];
  if (allIps.length > 0) {
    const ipList = allIps.map((_, i) => `@ip${i}`).join(", ");
    const wfRequest = db.request();
    const rwRequest = db.request();
    allIps.forEach((ip, i) => {
      wfRequest.input(`ip${i}`, sql.VarChar, ip);
      rwRequest.input(`ip${i}`, sql.VarChar, ip);
    });

    const [webFilterResult, routerWebResult] = await Promise.all([
      wfRequest.query<WebFilterRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, Domain, Url, Category, Action
        FROM WebFilterLogs WHERE SrcIp IN (${ipList}) ORDER BY ReceivedAt DESC
      `),
      rwRequest.query<RouterWebRow>(`
        SELECT TOP 50 Id, ReceivedAt, SrcIp, DstIp, DstPort, ReverseDns
        FROM RouterWebLogs WHERE SrcIp IN (${ipList}) ORDER BY ReceivedAt DESC
      `),
    ]);
    webFilterRows = webFilterResult.recordset;
    routerWebRows = routerWebResult.recordset;
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar name={staffMember.Name} photoPath={staffMember.PhotoPath} size={48} />
        <h1 style={{ margin: 0 }}>{staffMember.Name}</h1>
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "0.25rem" }}>
        <Link href="/dashboard/staff" style={{ color: "var(--series-1)" }}>
          &larr; All Employees
        </Link>
      </p>

      <div className="dash-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem" }}>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Email:</span> {staffMember.Email ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Cell Number:</span> {staffMember.Phone ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Department:</span> {staffMember.Department ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Position:</span> {staffMember.Position ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Address:</span> {staffMember.Address ?? "-"}
          </span>
        </div>
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>Assigned Endpoint Agent</h2>
        {linkedDevice ? (
          <p style={{ fontSize: "0.85rem", margin: 0 }}>
            <Link href={`/dashboard/endpoint-agents/${linkedDevice.DeviceId}`} style={{ color: "var(--series-1)" }}>
              {linkedDevice.Hostname}
            </Link>{" "}
            <span style={{ color: "var(--ink-muted)" }}>
              ({linkedDevice.OS}) &middot; last heartbeat{" "}
              {linkedDevice.LastHeartbeat ? new Date(linkedDevice.LastHeartbeat).toLocaleString() : "never"}
            </span>
          </p>
        ) : (
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: 0 }}>
            No PC linked yet. Install the endpoint agent on this employee&apos;s computer, then set{" "}
            <Link href="/dashboard/endpoint-agents" style={{ color: "var(--series-1)" }}>
              that device&apos;s
            </Link>{" "}
            &quot;Assigned staff member&quot; field to this employee to enable per-employee reports (CPU, RAM,
            screenshots, software, processes).
          </p>
        )}
      </div>

      <div className="dash-panel">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.85rem" }}>
          <span>
            <span className={`status-dot status-${statusColor}`} style={{ marginRight: "0.4rem" }} />
            <span style={{ color: "var(--ink-muted)" }}>Status:</span>{" "}
            {!staffMember.MacAddress ? "No device assigned" : isOnline ? "Online" : "Offline"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>MAC Address:</span>{" "}
            {staffMember.MacAddress ?? "not assigned"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Current IP:</span>{" "}
            {currentIp ?? "not currently online"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Source:</span>{" "}
            {source === "mikrotik" ? "MikroTik" : source === "sophos" ? "Sophos" : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Device:</span> {deviceName ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Device Type:</span>{" "}
            {staffMember.MacAddress ? deviceType : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Operating System:</span>{" "}
            {os ?? "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Last Seen:</span>{" "}
            {seenAt ? seenAt.toLocaleString() : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>First Seen:</span>{" "}
            {firstSeen ? `${firstSeen.toLocaleString()} (${formatDuration(firstSeen)} ago)` : "-"}
          </span>
        </div>
      </div>

      {allIps.length > 1 && (
        <div className="dash-panel">
          <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>Device IP History</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
            This MAC address has used {allIps.length} different IPs over time (DHCP renewals) — the report below
            covers activity across all of them.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>IP Address</th>
                <th style={{ padding: "0.4rem" }}>Network</th>
                <th style={{ padding: "0.4rem" }}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {historicalIps.map((h) => (
                <tr key={`${h.Source}-${h.IpAddress}`} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{h.IpAddress}</td>
                  <td style={{ padding: "0.4rem" }}>{h.Source === "mikrotik" ? "MikroTik" : "Sophos"}</td>
                  <td style={{ padding: "0.4rem" }}>{new Date(h.UpdatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {allIps.length === 0 ? (
        <div className="dash-panel">
          <p style={{ color: "var(--ink-muted)" }}>
            No device currently assigned or ever seen for this staff member, so no activity to show.
          </p>
        </div>
      ) : (
        <>
          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
              Sophos Web Filter — activity report
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              Across all known IPs for this device, most recent first (up to 50 shown).
            </p>
            {webFilterRows.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>No Web Filter events for this device yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>IP</th>
                    <th style={{ padding: "0.4rem" }}>Domain</th>
                    <th style={{ padding: "0.4rem" }}>Category</th>
                    <th style={{ padding: "0.4rem" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {webFilterRows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        {new Date(r.ReceivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/web-filter/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.Domain ?? r.Url ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Category ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Action ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="dash-panel">
            <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.5rem" }}>
              Router Web Connections — activity report
            </h2>
            <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0 }}>
              Across all known IPs for this device, most recent first (up to 50 shown).
            </p>
            {routerWebRows.length === 0 ? (
              <p style={{ color: "var(--ink-muted)" }}>No router web connections for this device yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "0.4rem" }}>Time</th>
                    <th style={{ padding: "0.4rem" }}>IP</th>
                    <th style={{ padding: "0.4rem" }}>Destination</th>
                    <th style={{ padding: "0.4rem" }}>Port</th>
                  </tr>
                </thead>
                <tbody>
                  {routerWebRows.map((r) => (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        {new Date(r.ReceivedAt).toLocaleString()}
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/router-web/${encodeURIComponent(r.SrcIp)}`} style={{ color: "var(--series-1)" }}>
                          {r.SrcIp}
                        </Link>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {r.ReverseDns ?? r.DstIp ?? "-"}
                        {r.ReverseDns && (
                          <span style={{ color: "var(--ink-muted)", fontSize: "0.75rem" }}> ({r.DstIp})</span>
                        )}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{r.DstPort ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

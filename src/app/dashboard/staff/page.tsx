import Link from "next/link";
import { getDb } from "@/lib/db";
import { addStaff, removeStaff } from "./actions";
import { getStaffWithStatus, formatDuration } from "@/lib/staffStatus";
import DeviceSelect from "@/components/DeviceSelect";

export const dynamic = "force-dynamic";

interface AvailableDevice {
  IpAddress: string;
  MacAddress: string;
  Hostname: string | null;
  Source: "Mikrotik" | "Sophos";
}

function StatTile({ label, value, status }: { label: string; value: string | number; status: string }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

function FilterTile({
  label,
  value,
  status,
  href,
  active,
}: {
  label: string;
  value: string | number;
  status: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`stat-tile status-${status}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        outline: active ? "2px solid var(--series-1)" : "none",
        outlineOffset: "-2px",
      }}
    >
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </Link>
  );
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; type?: string }>;
}) {
  const { error, type: typeFilter } = await searchParams;
  const db = await getDb();

  const staff = await getStaffWithStatus();

  const availableResult = await db.query<AvailableDevice>(`
    SELECT * FROM (
      SELECT IpAddress, MacAddress, Hostname, 'Mikrotik' AS Source
      FROM RouterClients
      WHERE MacAddress IS NOT NULL
        AND UPPER(MacAddress) NOT IN (SELECT UPPER(MacAddress) FROM Staff WHERE MacAddress IS NOT NULL)
      UNION ALL
      SELECT IpAddress, MacAddress, Hostname, 'Sophos' AS Source
      FROM SophosClients
      WHERE MacAddress IS NOT NULL
        AND UPPER(MacAddress) NOT IN (SELECT UPPER(MacAddress) FROM Staff WHERE MacAddress IS NOT NULL)
    ) combined
    ORDER BY Source,
      CAST(PARSENAME(IpAddress, 4) AS INT),
      CAST(PARSENAME(IpAddress, 3) AS INT),
      CAST(PARSENAME(IpAddress, 2) AS INT),
      CAST(PARSENAME(IpAddress, 1) AS INT)
  `);
  const available = availableResult.recordset;

  const online = staff.filter((s) => s.isOnline).length;
  const unassigned = staff.filter((s) => !s.MacAddress).length;
  const offline = staff.length - online - unassigned;

  // Device type only means something once a device is assigned, so counts/filter exclude
  // unassigned staff rather than lumping them into "Other".
  const assigned = staff.filter((s) => s.MacAddress);
  const pcCount = assigned.filter((s) => s.deviceType === "PC/Laptop").length;
  const mobileCount = assigned.filter((s) => s.deviceType === "Mobile").length;
  const otherCount = assigned.filter((s) => s.deviceType === "Other").length;

  const visibleStaff = typeFilter ? staff.filter((s) => s.MacAddress && s.deviceType === typeFilter) : staff;

  return (
    <div>
      <h1>Staff</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        A staff member is mapped to a <strong>MAC address</strong>, not an IP — the IP shown below is just the
        device&apos;s <em>current</em> address, resolved live from the MikroTik router&apos;s DHCP leases or this
        server&apos;s ARP table for Sophos-side clients. Every IP that MAC has ever used is kept, so the activity
        report on each staff member&apos;s page covers their full history even after an IP changes — not just today.
        Everything here (Staff, device history, Web Filter, Router logs) is stored permanently in the SQL database,
        nothing is held only in memory. Online/Offline and First Seen are based on network activity only — there&apos;s
        no OS login time, and CPU/RAM/screen data isn&apos;t available without an endpoint agent installed on each PC.
      </p>

      {error && (
        <div
          style={{
            background: "var(--critical)",
            color: "#fff",
            padding: "0.6rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.85rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      <div className="stat-grid">
        <StatTile label="Total Staff" value={staff.length} status="unknown" />
        <StatTile label="Online" value={online} status={online > 0 ? "good" : "unknown"} />
        <StatTile label="Offline" value={offline} status={offline > 0 ? "warning" : "good"} />
        <StatTile label="Unassigned Device" value={unassigned} status={unassigned > 0 ? "warning" : "good"} />
      </div>

      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginBottom: "0.4rem" }}>
        Filter by device type (click a tile; click again to clear):
      </p>
      <div className="stat-grid">
        <FilterTile
          label="All Devices"
          value={assigned.length}
          status="unknown"
          href="/dashboard/staff"
          active={!typeFilter}
        />
        <FilterTile
          label="PC/Laptop"
          value={pcCount}
          status={typeFilter === "PC/Laptop" ? "good" : "unknown"}
          href={typeFilter === "PC/Laptop" ? "/dashboard/staff" : `/dashboard/staff?type=${encodeURIComponent("PC/Laptop")}`}
          active={typeFilter === "PC/Laptop"}
        />
        <FilterTile
          label="Mobile"
          value={mobileCount}
          status={typeFilter === "Mobile" ? "good" : "unknown"}
          href={typeFilter === "Mobile" ? "/dashboard/staff" : "/dashboard/staff?type=Mobile"}
          active={typeFilter === "Mobile"}
        />
        <FilterTile
          label="Other"
          value={otherCount}
          status={typeFilter === "Other" ? "good" : "unknown"}
          href={typeFilter === "Other" ? "/dashboard/staff" : "/dashboard/staff?type=Other"}
          active={typeFilter === "Other"}
        />
      </div>

      <div className="dash-panel">
        <h2 style={{ fontSize: "1rem", marginTop: 0, marginBottom: "0.75rem" }}>Add Staff</h2>
        <form action={addStaff} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 200px" }}>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" required placeholder="e.g. Samjhana" />
          </div>
          <div className="field" style={{ marginBottom: 0, flex: "1 1 320px" }}>
            <label htmlFor="mac">Device (MikroTik or Sophos client)</label>
            <DeviceSelect devices={available} />
          </div>
          <button className="submit" type="submit" style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
            Add
          </button>
        </form>
      </div>

      <div className="dash-panel">
        {staff.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No staff added yet.</p>
        ) : visibleStaff.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>
            No staff with a &quot;{typeFilter}&quot; device.{" "}
            <Link href="/dashboard/staff" style={{ color: "var(--series-1)" }}>
              Clear filter
            </Link>
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Computer Name</th>
                <th style={{ padding: "0.5rem" }}>Type</th>
                <th style={{ padding: "0.5rem" }}>Operating System</th>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>Last Seen</th>
                <th style={{ padding: "0.5rem" }}>First Seen</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
                <th style={{ padding: "0.5rem" }}>Source</th>
                <th style={{ padding: "0.5rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((s) => {
                const status = !s.MacAddress ? "unknown" : s.isOnline ? "good" : "warning";
                return (
                  <tr key={s.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.5rem" }}>
                      <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                      <Link href={`/dashboard/staff/${s.Id}`} style={{ color: "var(--series-1)" }}>
                        {s.Name}
                      </Link>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      {!s.MacAddress ? "No device" : s.isOnline ? "Online" : "Offline"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{s.deviceName ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{s.MacAddress ? s.deviceType : "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{s.os ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>{s.currentIp ?? "not currently online"}</td>
                    <td style={{ padding: "0.5rem" }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {s.firstSeen ? `${formatDuration(s.firstSeen)} ago` : "-"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>{s.MacAddress ?? "-"}</td>
                    <td style={{ padding: "0.5rem" }}>
                      {s.source === "mikrotik" ? "MikroTik" : s.source === "sophos" ? "Sophos" : "-"}
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <form action={removeStaff}>
                        <input type="hidden" name="id" value={s.Id} />
                        <button
                          type="submit"
                          style={{
                            background: "none",
                            border: "1px solid var(--border)",
                            color: "var(--ink-muted)",
                            borderRadius: 6,
                            padding: "0.25rem 0.6rem",
                            fontSize: "0.78rem",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

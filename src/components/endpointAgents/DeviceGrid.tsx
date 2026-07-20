"use client";

import { useState } from "react";
import Link from "next/link";
import { Laptop, MonitorX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Deliberately minimal per an explicit request to strip this view down to just enrollment
// essentials - no OS/hardware/software details, no live health stats, no per-device admin
// actions. Anything beyond these four fields belongs on the device's own detail page (or the
// employee's page, which now embeds the same report - see DeviceReportToggle).
export interface DeviceRow {
  deviceId: string;
  hostname: string;
  staffName: string | null;
  lastIp: string | null;
  macAddress: string | null;
}

export function DeviceGrid({ devices }: { devices: DeviceRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = devices.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.hostname.toLowerCase().includes(q) ||
      (d.staffName ?? "").toLowerCase().includes(q) ||
      (d.lastIp ?? "").includes(q) ||
      (d.macAddress ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search by employee, hostname, IP, or MAC..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 400,
          padding: "0.5rem 0.75rem",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontSize: "0.85rem",
          marginBottom: "1rem",
        }}
      />

      {filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-6" style={{ color: "var(--ink-muted)" }}>
            <MonitorX size={28} />
            <p>{devices.length === 0 ? "No devices enrolled yet." : "No devices match your search."}</p>
            {devices.length === 0 && (
              <Link href="/dashboard/endpoint-agents/enroll" style={{ color: "var(--primary)", fontSize: "0.85rem" }}>
                Generate an enrollment token to install the agent on a device
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>Enrollment Status</th>
                <th style={{ padding: "0.5rem" }}>Employee Name</th>
                <th style={{ padding: "0.5rem" }}>IP Address</th>
                <th style={{ padding: "0.5rem" }}>MAC Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.deviceId} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.5rem" }}>
                    <Badge tone="success">Enrolled</Badge>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {d.staffName ? (
                      <Link href="/dashboard/staff" style={{ color: "var(--series-1)" }}>
                        {d.staffName}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--ink-muted)" }}>Unassigned ({d.hostname})</span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{d.lastIp ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{d.macAddress ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--ink-muted)", display: "flex", alignItems: "center", gap: 6 }}>
        <Laptop size={12} /> {devices.length} device{devices.length === 1 ? "" : "s"} enrolled
      </div>
    </div>
  );
}

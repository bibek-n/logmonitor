"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";
import { EditEmployeeModal, type EditableEmployee } from "./EditEmployeeModal";
import { removeStaff } from "@/app/dashboard/staff/actions";

export interface EmployeeRow extends EditableEmployee {
  isOnline: boolean;
  MacAddress: string | null;
  deviceName: string | null;
  deviceType: string;
  os: string | null;
  currentIp: string | null;
  lastSeen: Date | null;
  firstSeen: Date | null;
  source: "mikrotik" | "sophos" | null;
}

function formatDuration(from: Date | null): string {
  if (!from) return "-";
  const ms = Date.now() - from.getTime();
  if (ms < 0) return "-";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function EmployeesTableInner({ employees }: { employees: EmployeeRow[] }) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
            <th style={{ padding: "0.5rem" }}></th>
            <th style={{ padding: "0.5rem" }}>Name</th>
            <th style={{ padding: "0.5rem" }}>Status</th>
            <th style={{ padding: "0.5rem" }}>Department</th>
            <th style={{ padding: "0.5rem" }}>Position</th>
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
          {employees.map((s) => {
            const status = !s.MacAddress ? "unknown" : s.isOnline ? "good" : "warning";
            return (
              <tr key={s.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.5rem" }}>
                  <Avatar name={s.Name} photoPath={s.PhotoPath} size={28} />
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                  <Link href={`/dashboard/staff/${s.Id}`} style={{ color: "var(--series-1)" }}>
                    {s.Name}
                  </Link>
                </td>
                <td style={{ padding: "0.5rem" }}>{!s.MacAddress ? "No device" : s.isOnline ? "Online" : "Offline"}</td>
                <td style={{ padding: "0.5rem" }}>{s.Department ?? "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.Position ?? "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.deviceName ?? "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.MacAddress ? s.deviceType : "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.os ?? "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.currentIp ?? "not currently online"}</td>
                <td style={{ padding: "0.5rem" }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.firstSeen ? `${formatDuration(s.firstSeen)} ago` : "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.MacAddress ?? "-"}</td>
                <td style={{ padding: "0.5rem" }}>{s.source === "mikrotik" ? "MikroTik" : s.source === "sophos" ? "Sophos" : "-"}</td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => setEditing(s)}
                    title="Edit"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", marginRight: 10 }}
                  >
                    <Pencil size={14} />
                  </button>
                  <form action={removeStaff} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={s.Id} />
                    <button
                      type="submit"
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        color: "var(--ink-muted)",
                        borderRadius: 6,
                        padding: "0.2rem 0.55rem",
                        fontSize: "0.75rem",
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

      {editing && <EditEmployeeModal employee={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function EmployeesTable({ employees }: { employees: EmployeeRow[] }) {
  return (
    <ToastProvider>
      <EmployeesTableInner employees={employees} />
    </ToastProvider>
  );
}

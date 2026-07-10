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

function EmployeesTableInner({ employees }: { employees: EmployeeRow[] }) {
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <>
      {/* Device Type/OS/First Seen/Source stay on each employee's own detail page — with a
          photo column and HR fields added, keeping every column here made the list overflow
          and feel cluttered next to the rest of the app's tables (all of which stay this
          narrow), so this list now only shows what's useful at a glance. */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}></th>
              <th style={{ padding: "0.5rem" }}>Name</th>
              <th style={{ padding: "0.5rem" }}>Status</th>
              <th style={{ padding: "0.5rem" }}>Department</th>
              <th style={{ padding: "0.5rem" }}>Position</th>
              <th style={{ padding: "0.5rem" }}>Computer Name</th>
              <th style={{ padding: "0.5rem" }}>IP Address</th>
              <th style={{ padding: "0.5rem" }}>Last Seen</th>
              <th style={{ padding: "0.5rem" }}>MAC Address</th>
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
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    <span className={`status-dot status-${status}`} style={{ marginRight: "0.4rem" }} />
                    <Link href={`/dashboard/staff/${s.Id}`} style={{ color: "var(--series-1)" }}>
                      {s.Name}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem" }}>{!s.MacAddress ? "No device" : s.isOnline ? "Online" : "Offline"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Department ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Position ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.deviceName ?? "-"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.currentIp ?? "not currently online"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.MacAddress ?? "-"}</td>
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
      </div>

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

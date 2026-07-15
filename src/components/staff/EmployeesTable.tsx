"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Search, X } from "lucide-react";
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
  const t = useTranslations("employees.table");
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (s) =>
        s.Name.toLowerCase().includes(q) ||
        (s.deviceName ?? "").toLowerCase().includes(q) ||
        (s.currentIp ?? "").toLowerCase().includes(q) ||
        (s.MacAddress ?? "").toLowerCase().includes(q)
    );
  }, [employees, search]);

  return (
    <>
      <div style={{ position: "relative", maxWidth: 400, marginBottom: "1rem" }}>
        <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          style={{
            width: "100%",
            padding: "0.5rem 2rem 0.5rem 1.9rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontSize: "0.85rem",
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label={t("removeButton")}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--ink-muted)", cursor: "pointer", display: "flex" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Device Type/OS/First Seen/Source stay on each employee's own detail page — with a
          photo column and HR fields added, keeping every column here made the list overflow
          and feel cluttered next to the rest of the app's tables (all of which stay this
          narrow), so this list now only shows what's useful at a glance. */}
      {filteredEmployees.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>{t("noMatchesText")}</p>
      ) : (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}></th>
              <th style={{ padding: "0.5rem" }}>{t("nameColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("statusColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("departmentColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("positionColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("computerNameColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("ipAddressColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("lastSeenColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("macAddressColumn")}</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((s) => {
              const status = !s.MacAddress ? "unknown" : s.isOnline ? "good" : "critical";
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
                  <td style={{ padding: "0.5rem" }}>{!s.MacAddress ? t("noDeviceStatus") : s.isOnline ? t("onlineStatus") : t("offlineStatus")}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Department ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Position ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.deviceName ?? "-"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.currentIp ?? t("notCurrentlyOnlineFallback")}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.MacAddress ?? "-"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    <button
                      onClick={() => setEditing(s)}
                      title={t("editTitle")}
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
                        {t("removeButton")}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

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

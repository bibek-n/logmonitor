"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Search, X, Globe } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ToastProvider } from "@/components/ui/Toast";
import { EditEmployeeModal, type EditableEmployee } from "./EditEmployeeModal";
import { removeStaff } from "@/app/dashboard/staff/actions";

// Deliberately NOT imported from @/lib/staffStatus - that module pulls in src/lib/db.ts
// (mssql/tedious, server-only) transitively, which webpack correctly refuses to bundle into
// this "use client" component. Duplicated here rather than restructuring staffStatus.ts, since
// this is the only piece of it a client component needs.
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
  webActivityCount: number;
  webActivityLastSeen: Date | null;
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
        (s.Email ?? "").toLowerCase().includes(q) ||
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
          narrow), so this list only shows what's useful at a glance (Email included, since
          it's needed for quick lookup/contact directly from the list). */}
      {filteredEmployees.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>{t("noMatchesText")}</p>
      ) : (
      <>
      <div className="flex flex-col gap-3 md:hidden">
        {filteredEmployees.map((s) => {
          const status = !s.MacAddress ? "unknown" : s.isOnline ? "good" : "critical";
          return (
            <div key={s.Id} className="flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "0.9rem 1rem" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Avatar name={s.Name} photoPath={s.PhotoPath} size={32} />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className={`status-dot status-${status}`} />
                      <Link href={`/dashboard/staff/${s.Id}`} style={{ color: "var(--series-1)", fontWeight: 600 }}>
                        {s.Name}
                      </Link>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                      {!s.MacAddress ? t("noDeviceStatus") : s.isOnline ? t("onlineStatus") : t("offlineStatus")}
                    </p>
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-2" style={{ margin: 0, fontSize: "0.78rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("emailColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.Email ?? "-"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("departmentColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.Department ?? "-"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("positionColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.Position ?? "-"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("computerNameColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.deviceName ?? "-"}</dd>
                </div>
                <div>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("ipAddressColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.currentIp ?? t("notCurrentlyOnlineFallback")}</dd>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("lastSeenColumn")}</dt>
                  <dd style={{ margin: 0 }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</dd>
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <dt style={{ color: "var(--ink-muted)" }}>{t("macAddressColumn")}</dt>
                  <dd style={{ margin: 0, fontFamily: "monospace" }}>{s.MacAddress ?? "-"}</dd>
                </div>
                {s.webActivityCount > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <dt style={{ color: "var(--ink-muted)" }}>{t("webActivityColumn")}</dt>
                    <dd style={{ margin: 0 }}>
                      <Link
                        href={`/dashboard/staff/${s.Id}#router-web`}
                        style={{ color: "var(--series-1)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                        title={t("webActivityTitle", { count: s.webActivityCount })}
                      >
                        <Globe size={12} />
                        {t("webActivityAgo", { duration: formatDuration(s.webActivityLastSeen) })}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
              <div className="flex items-center gap-3" style={{ marginTop: "0.15rem" }}>
                <button
                  onClick={() => setEditing(s)}
                  className="flex items-center gap-1"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: "0.8rem", padding: 0 }}
                >
                  <Pencil size={13} /> {t("editTitle")}
                </button>
                <form action={removeStaff}>
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
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden md:block" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem" }}></th>
              <th style={{ padding: "0.5rem" }}>{t("nameColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("statusColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("emailColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("departmentColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("positionColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("computerNameColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("ipAddressColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("lastSeenColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("macAddressColumn")}</th>
              <th style={{ padding: "0.5rem" }}>{t("webActivityColumn")}</th>
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
                  <td style={{ padding: "0.5rem" }}>{s.Email ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Department ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.Position ?? "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{s.deviceName ?? "-"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.currentIp ?? t("notCurrentlyOnlineFallback")}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{s.lastSeen ? s.lastSeen.toLocaleString() : "-"}</td>
                  <td style={{ padding: "0.5rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.MacAddress ?? "-"}</td>
                  <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>
                    {s.webActivityCount > 0 ? (
                      <Link
                        href={`/dashboard/staff/${s.Id}#router-web`}
                        style={{ color: "var(--series-1)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                        title={t("webActivityTitle", { count: s.webActivityCount })}
                      >
                        <Globe size={12} />
                        {t("webActivityAgo", { duration: formatDuration(s.webActivityLastSeen) })}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </td>
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
      </>
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

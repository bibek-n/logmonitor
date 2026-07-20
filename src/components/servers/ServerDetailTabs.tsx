import Link from "next/link";

interface ServerDetailTabsProps {
  deviceId: string;
  active: "overview" | "logs" | "mssql";
  logCount: number;
  mssqlLogCount?: number;
}

// Both pages are separate server-rendered routes (not client-side tab state), so "active tab"
// is just which route we're on - Link navigation, no onClick/useState needed.
export function ServerDetailTabs({ deviceId, active, logCount, mssqlLogCount }: ServerDetailTabsProps) {
  const tabs = [
    { key: "overview" as const, label: "Overview", href: `/dashboard/servers/${deviceId}` },
    { key: "logs" as const, label: `Logs (${logCount})`, href: `/dashboard/servers/${deviceId}/logs` },
    { key: "mssql" as const, label: `MSSQL (${mssqlLogCount ?? 0})`, href: `/dashboard/servers/${deviceId}/mssql` },
  ];

  return (
    <div
      className="flex gap-1"
      style={{ borderBottom: "1px solid var(--border)", marginBottom: "1.25rem" }}
    >
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          style={{
            padding: "0.55rem 1rem",
            fontSize: "0.85rem",
            fontWeight: active === t.key ? 600 : 400,
            color: active === t.key ? "var(--primary)" : "var(--ink-muted)",
            borderBottom: active === t.key ? "2px solid var(--primary)" : "2px solid transparent",
            marginBottom: -1,
          }}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

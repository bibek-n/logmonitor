import Link from "next/link";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { getTopIps, getTopWebsites, getTopUsers, getTopServers, getTopRouterClients } from "@/lib/topConsumers";

export const dynamic = "force-dynamic";

const LIMIT = 20;
const TABS = [
  { key: "ips", label: "Top IPs" },
  { key: "websites", label: "Top Websites" },
  { key: "users", label: "Top Users" },
  { key: "servers", label: "Top Servers" },
  { key: "router", label: "Top Router Clients" },
] as const;
const WINDOWS = [
  { key: "4", label: "4h" },
  { key: "24", label: "24h" },
  { key: "168", label: "7d" },
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = -1;
  do {
    value /= 1024;
    i++;
  } while (value >= 1024 && i < units.length - 1);
  return `${value.toFixed(1)} ${units[i]}`;
}

export default async function TopConsumersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; hours?: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Top Consumers</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can view this page.</p>
      </div>
    );
  }

  const { tab: tabParam, hours: hoursParam } = await searchParams;
  const tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "ips";
  const hours = WINDOWS.some((w) => w.key === hoursParam) ? Number(hoursParam) : 24;

  const baseHref = "/dashboard/top-consumers";
  const tabHref = (t: string) => `${baseHref}?tab=${t}&hours=${hours}`;
  const hoursHref = (h: string) => `${baseHref}?tab=${tab}&hours=${h}`;

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Top Consumers</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Bandwidth consumption ranked by source IP, destination website, resolved user, server
        network usage, and MikroTik router client - from the Sophos web filter, endpoint agent
        metrics, and the router&apos;s own IP accounting.
      </p>

      <div className="flex gap-1" style={{ borderBottom: "1px solid var(--border)", marginBottom: "1rem", overflowX: "auto" }}>
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={tabHref(t.key)}
            style={{
              padding: "0.55rem 1rem",
              fontSize: "0.85rem",
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "var(--primary)" : "var(--ink-muted)",
              borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4" style={{ fontSize: "0.8rem" }}>
        {WINDOWS.map((w) => (
          <Link
            key={w.key}
            href={hoursHref(w.key)}
            style={{
              padding: "0.3rem 0.7rem",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: hours === Number(w.key) ? "var(--primary)" : "var(--surface-2)",
              color: hours === Number(w.key) ? "#fff" : "var(--ink)",
            }}
          >
            {w.label}
          </Link>
        ))}
      </div>

      <Card>
        {tab === "ips" && <IpsTable hours={hours} />}
        {tab === "websites" && <WebsitesTable hours={hours} />}
        {tab === "users" && <UsersTable hours={hours} />}
        {tab === "servers" && <ServersTable hours={hours} />}
        {tab === "router" && <RouterClientsTable hours={hours} />}
      </Card>
    </div>
  );
}

async function IpsTable({ hours }: { hours: number }) {
  const rows = await getTopIps(hours, LIMIT);
  if (rows.length === 0) return <Empty />;
  return (
    <Table
      headers={["IP", "Name", "Data", "Requests"]}
      rows={rows.map((r) => ({
        key: r.ip,
        values: [r.ip, r.name ?? "-", formatBytes(r.totalBytes), r.requests],
      }))}
    />
  );
}

async function WebsitesTable({ hours }: { hours: number }) {
  const rows = await getTopWebsites(hours, LIMIT);
  if (rows.length === 0) return <Empty />;
  return (
    <Table
      headers={["Website", "Data", "Requests"]}
      rows={rows.map((r) => ({
        key: r.website,
        values: [r.website, formatBytes(r.totalBytes), r.requests],
      }))}
    />
  );
}

async function UsersTable({ hours }: { hours: number }) {
  const rows = await getTopUsers(hours, LIMIT);
  if (rows.length === 0) return <Empty />;
  return (
    <Table
      headers={["User", "Data", "Requests"]}
      rows={rows.map((r) => ({
        key: r.user,
        values: [r.user, formatBytes(r.totalBytes), r.requests],
      }))}
    />
  );
}

async function ServersTable({ hours }: { hours: number }) {
  const rows = await getTopServers(hours, LIMIT);
  if (rows.length === 0) return <Empty />;
  return (
    <Table
      headers={["Server", "Avg Mbps", "Peak Mbps"]}
      rows={rows.map((r) => ({
        key: r.device,
        values: [r.device, r.avgNetMbps, r.maxNetMbps],
      }))}
    />
  );
}

async function RouterClientsTable({ hours }: { hours: number }) {
  const rows = await getTopRouterClients(hours, LIMIT);
  if (rows.length === 0) return <Empty />;
  return (
    <Table
      headers={["IP", "Name", "Data", "Flows"]}
      rows={rows.map((r) => ({
        key: r.ip,
        values: [r.ip, r.name ?? "-", formatBytes(r.totalBytes), r.flows],
      }))}
    />
  );
}

const rowStyle = { borderBottom: "1px solid var(--grid)" };
const cellStyle = { padding: "0.5rem" };

interface TableRow {
  key: string;
  values: React.ReactNode[];
}

function Table({ headers, rows }: { headers: string[]; rows: TableRow[] }) {
  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <div key={row.key} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
            <dl className="grid grid-cols-2 gap-1" style={{ margin: 0, fontSize: "0.8rem" }}>
              {headers.map((h, i) => (
                <div key={h} style={i === 0 ? { gridColumn: "1 / -1" } : undefined}>
                  <dt style={{ color: "var(--ink-muted)", fontSize: "0.72rem" }}>{h}</dt>
                  <dd style={{ margin: 0, fontWeight: i === 0 ? 600 : 400 }}>{row.values[i]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden md:block" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {headers.map((h) => (
                <th key={h} style={{ padding: "0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} style={rowStyle}>
                {row.values.map((v, i) => (
                  <td key={i} style={cellStyle}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Empty() {
  return <p style={{ color: "var(--ink-muted)" }}>No data in this window.</p>;
}

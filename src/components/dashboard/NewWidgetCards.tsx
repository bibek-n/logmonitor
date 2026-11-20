import Link from "next/link";
import {
  Users,
  ShieldCheck,
  KeyRound,
  LogIn,
  Bug,
  MonitorSmartphone,
  HardDrive,
  Globe2,
  Activity,
  Bot,
  Database,
  Wifi,
  UserPlus,
  PlusCircle,
  Zap,
  ShieldOff,
  Shield,
  Upload,
  PlayCircle,
  ScrollText,
  Sunrise,
  Wrench,
  Siren,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type {
  QuickStats,
  UserManagementSummary,
  SecurityCenterSummary,
  RemoteAccessSummary,
  ItAssetSummary,
  BrowserActivitySummary,
  WebsiteManagementSummary,
  MonitoringSummary,
  AutomationSummary,
  AdministrationSummary,
  ActivityFeedEntry,
  NotificationsSummary,
  PatchStatusSummary,
  RecentIncident,
  NetworkFirewallSummary,
} from "@/lib/dashboardLayouts/queries";

// Every stat/list item across these widgets is a real navigable destination (verified against
// src/lib/navRoutes.ts, same as the Quick Actions widget) - clicking a number takes you to
// the actual page that explains it, rather than the number being a dead end.
function StatTile({ label, value, tone, href }: { label: string; value: string | number; tone?: "danger" | "warning" | "success"; href?: string }) {
  const color = tone === "danger" ? "var(--danger)" : tone === "warning" ? "var(--warning)" : tone === "success" ? "var(--success)" : "var(--ink)";
  const content = (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>{label}</div>
    </div>
  );
  if (!href) return content;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block", borderRadius: 6, margin: -4, padding: 4 }} className="stat-tile-link">
      {content}
    </Link>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  critical: "var(--danger)",
  high: "var(--danger)",
  medium: "var(--warning)",
  low: "var(--warning)",
  informational: "var(--ink-muted)",
};

// Replaces a single "N open alerts" number (which tells you nothing about whether those are
// 5 critical or 5 informational) with one segment per severity that actually has alerts -
// each segment links straight into the Security Center alerts list pre-filtered to that
// severity, so a click goes to the triage queue, not just a bare count.
function SeverityBreakdownTile({ label, bySeverity, href }: { label: string; bySeverity: Record<string, number>; href: string }) {
  const total = Object.values(bySeverity).reduce((a, b) => a + b, 0);
  const nonZero = Object.entries(bySeverity).filter(([, n]) => n > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: total > 0 ? "var(--danger)" : "var(--success)", lineHeight: 1.1 }}>{total}</div>
      <div style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>{label}</div>
      {nonZero.length > 0 && (
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: 2 }}>
          {nonZero.map(([sev, n]) => (
            <Link
              key={sev}
              href={`${href}?severity=${sev}`}
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "0.1rem 0.4rem",
                borderRadius: 999,
                color: SEVERITY_TONE[sev] ?? "var(--ink-muted)",
                background: `color-mix(in srgb, ${SEVERITY_TONE[sev] ?? "var(--ink-muted)"} 16%, transparent)`,
                textDecoration: "none",
              }}
            >
              {sev.slice(0, 4)} {n}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CardHeader({ icon: Icon, title, href }: { icon: typeof Users; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
      <div className="flex items-center gap-2">
        <Icon size={17} style={{ color: "var(--primary)" }} />
        <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>{title}</h2>
      </div>
      {href && (
        <Link href={href} style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      )}
    </div>
  );
}

export function QuickStatsCard({ stats }: { stats: QuickStats }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Activity} title="Quick Stats" />
      <div className="ov-kpi-grid">
        <StatTile label="Total Users" value={stats.totalUsers} href="/dashboard/settings" />
        <StatTile label="Active Devices" value={stats.activeDevices} href="/dashboard/endpoint-agents" />
        <StatTile label="Online Servers" value={stats.onlineServers} href="/dashboard/servers" />
        <StatTile label="Active Websites" value={stats.activeWebsites} href="/dashboard/audit/websites" />
        <StatTile label="Running Automations" value={stats.runningAutomations} href="/dashboard/automation/tasks" />
        <SeverityBreakdownTile label="Open Security Alerts" bySeverity={stats.openSecurityAlertsBySeverity} href="/dashboard/security" />
      </div>
    </Card>
  );
}

export function UserSummaryCard({ summary }: { summary: UserManagementSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Users} title="User Summary" href="/dashboard/settings" />
      <div className="ov-two-col" style={{ gap: 12 }}>
        <StatTile label="Total Users" value={summary.totalUsers} href="/dashboard/settings" />
        <StatTile label="Active" value={summary.activeUsers} tone="success" href="/dashboard/settings" />
        <StatTile label="Disabled" value={summary.disabledUsers} href="/dashboard/settings" />
        <StatTile label="MFA Enabled" value={summary.mfaEnabledUsers} href="/dashboard/settings" />
      </div>
    </Card>
  );
}

export function LoginStatisticsCard({ summary }: { summary: UserManagementSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={LogIn} title="Login Statistics" href="/dashboard/settings" />
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", margin: "0 0 0.75rem" }}>Last 24 hours</p>
      <div className="ov-two-col" style={{ gap: 12 }}>
        <StatTile label="Successful" value={summary.loginSuccess24h} tone="success" href="/dashboard/settings" />
        <StatTile label="Failed" value={summary.loginFailed24h} tone={summary.loginFailed24h > 0 ? "warning" : undefined} href="/dashboard/settings" />
      </div>
    </Card>
  );
}

export function SecuritySummaryCard({ summary }: { summary: SecurityCenterSummary }) {
  const scoreColor = summary.overallScore >= 85 ? "var(--success)" : summary.overallScore >= 60 ? "var(--warning)" : "var(--danger)";
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={ShieldCheck} title="Security Score & Alerts" href="/dashboard/security-center" />
      <Link href="/dashboard/security-center" className="ov-row-link flex items-center gap-4" style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "2.2rem", fontWeight: 700, color: scoreColor }}>{summary.overallScore}</div>
        <div style={{ fontSize: "0.8125rem", color: "var(--ink-muted)" }}>Overall Security Score</div>
      </Link>
      <div className="ov-two-col" style={{ gap: 12 }}>
        <StatTile label="Critical Alerts" value={summary.criticalAlerts} tone={summary.criticalAlerts > 0 ? "danger" : "success"} href="/dashboard/security-center" />
        <StatTile label="Blocked IPs" value={summary.blockedIps} href="/dashboard/security" />
        <StatTile label="Firewall Off" value={summary.devicesWithFirewallOff} tone={summary.devicesWithFirewallOff > 0 ? "warning" : "success"} href="/dashboard/security-center" />
        <StatTile label="AV Disabled" value={summary.devicesWithAvDisabled} tone={summary.devicesWithAvDisabled > 0 ? "danger" : "success"} href="/dashboard/security-center" />
      </div>
    </Card>
  );
}

export function VulnerabilitySummaryCard({ summary }: { summary: SecurityCenterSummary }) {
  const entries = Object.entries(summary.vulnerabilitiesBySeverity);
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Bug} title="Vulnerability Summary" href="/dashboard/security-center/vulnerability-scanner" />
      {entries.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No open vulnerabilities.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(([severity, count]) => (
            <Link key={severity} href="/dashboard/security-center/vulnerability-scanner" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.85rem" }}>
              <span style={{ color: "var(--ink)" }}>{severity}</span>
              <Badge tone={severity === "Critical" || severity === "High" ? "danger" : "warning"}>{count}</Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function RemoteAccessSummaryCard({ summary }: { summary: RemoteAccessSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={MonitorSmartphone} title="Remote Access" href="/dashboard/remote-access/sessions" />
      <div className="ov-two-col" style={{ gap: 12, marginBottom: "0.75rem" }}>
        <StatTile label="Active Sessions" value={summary.activeSessions} tone={summary.activeSessions > 0 ? "success" : undefined} href="/dashboard/remote-access/sessions" />
        <StatTile label="Pending Requests" value={summary.pendingApprovalRequests} tone={summary.pendingApprovalRequests > 0 ? "warning" : undefined} href="/dashboard/remote-access" />
        <StatTile label="Avg. Session (min)" value={summary.avgSessionDurationMinutes ?? "-"} href="/dashboard/remote-access/sessions" />
      </div>
      {summary.recentSessions.length > 0 && (
        <div className="ov-scroll flex flex-col gap-1">
          {summary.recentSessions.map((s, i) => (
            <Link key={i} href="/dashboard/remote-access/sessions" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span style={{ color: "var(--ink)" }}>
                {s.protocol} - {s.targetHost}
              </span>
              <span style={{ color: "var(--ink-muted)" }}>{s.status}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function ItAssetSummaryCard({ summary }: { summary: ItAssetSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
        <div className="flex items-center gap-2">
          <HardDrive size={17} style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>Asset Summary</h2>
        </div>
        <Link href="/dashboard/it-assets" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      <div className="ov-kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
        <StatTile label="Active Assets" value={summary.totalActiveAssets} href="/dashboard/it-assets/assets" />
        <StatTile label="Assigned" value={summary.assignedAssets} href="/dashboard/it-assets/assets" />
        <StatTile label="Available" value={summary.availableAssets} tone="success" href="/dashboard/it-assets/assets" />
        <StatTile label="Warranty Expiring" value={summary.warrantyExpiringSoon} tone={summary.warrantyExpiringSoon > 0 ? "warning" : undefined} href="/dashboard/it-assets/assets" />
        <StatTile label="Licenses Expiring" value={summary.licencesExpiringSoon} tone={summary.licencesExpiringSoon > 0 ? "warning" : undefined} href="/dashboard/it-assets/software" />
        <StatTile label="Needs Inventory Check" value={summary.assetsNotCheckedRecently} href="/dashboard/it-assets/assets" />
      </div>
    </Card>
  );
}

export function BrowserActivitySummaryCard({ summary }: { summary: BrowserActivitySummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Globe2} title="Browser Activity" href="/dashboard/browser-activity/events" />
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", margin: "0 0 0.5rem" }}>
        {summary.activeDevices24h} device{summary.activeDevices24h === 1 ? "" : "s"} with browsing activity, last 24h
        {summary.securityEventCount > 0 && (
          <>
            {" "}
            &middot; <span style={{ color: "var(--danger)" }}>{summary.securityEventCount} high-risk visit{summary.securityEventCount === 1 ? "" : "s"}</span>
          </>
        )}
      </p>
      {summary.topDomains.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No browsing activity recorded.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {summary.topDomains.map((d) => (
            <Link key={d.domain} href="/dashboard/browser-activity/events" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span style={{ color: "var(--ink)" }}>{d.domain}</span>
              <span style={{ color: "var(--ink-muted)" }}>{d.visitCount} visits</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function WebsiteSummaryCard({ summary }: { summary: WebsiteManagementSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
        <div className="flex items-center gap-2">
          <Globe2 size={17} style={{ color: "var(--primary)" }} />
          <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>Website Summary</h2>
        </div>
        <Link href="/dashboard/audit/websites" style={{ fontSize: "0.78rem", color: "var(--primary)" }}>
          View all &rarr;
        </Link>
      </div>
      <div className="ov-kpi-grid" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatTile label="Total" value={summary.total} href="/dashboard/audit/websites" />
        <StatTile label="Live" value={summary.live} tone="success" href="/dashboard/audit/websites" />
        <StatTile label="Staging" value={summary.staging} href="/dashboard/audit/websites" />
        <StatTile label="Dev" value={summary.dev} href="/dashboard/audit/websites" />
      </div>
    </Card>
  );
}

export function MonitoringSummaryCard({ summary }: { summary: MonitoringSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Wifi} title="Uptime & Response Time" href="/dashboard/monitoring/websites" />
      <div className="ov-kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", marginBottom: "0.5rem" }}>
        <StatTile label="Websites Up" value={summary.websitesUp} tone="success" href="/dashboard/monitoring/websites" />
        <StatTile label="APIs Up" value={summary.apisUp} tone="success" href="/dashboard/monitoring/api" />
        <StatTile
          label="Down"
          value={summary.websitesDown + summary.apisDown}
          tone={summary.websitesDown + summary.apisDown > 0 ? "danger" : "success"}
          href="/dashboard/monitoring/incidents"
        />
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", margin: 0 }}>
        Avg. response: {summary.avgResponseMs != null ? `${summary.avgResponseMs} ms` : "-"} &middot; Error rate:{" "}
        {summary.errorRatePct != null ? `${summary.errorRatePct}%` : "-"} (last 24h)
      </p>
    </Card>
  );
}

export function AutomationSummaryCard({ summary }: { summary: AutomationSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Bot} title="Automation Summary" href="/dashboard/automation/tasks" />
      <div className="ov-kpi-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))", marginBottom: "0.5rem" }}>
        <StatTile label="Scheduled Jobs" value={summary.scheduledJobs} href="/dashboard/automation/schedules" />
        <StatTile label="Running" value={summary.running} tone={summary.running > 0 ? "success" : undefined} href="/dashboard/automation/tasks" />
        <StatTile label="Failed (7d)" value={summary.failed7d} tone={summary.failed7d > 0 ? "danger" : "success"} href="/dashboard/automation/tasks" />
      </div>
      <p style={{ fontSize: "0.8125rem", color: "var(--ink-muted)", margin: 0 }}>
        Success rate (7d): {summary.successRatePct != null ? `${summary.successRatePct}%` : "No completed runs yet"}
      </p>
    </Card>
  );
}

export function AdministrationSummaryCard({ summary }: { summary: AdministrationSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Database} title="Administration" href="/dashboard/settings" />
      <div className="flex flex-col gap-2">
        <Link href="/dashboard/settings" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "var(--ink-muted)" }}>Last Backup</span>
          <Badge tone={summary.lastBackupStatus === "Success" ? "success" : summary.lastBackupStatus ? "danger" : "neutral"}>
            {summary.lastBackupStatus ?? "No backups yet"}
          </Badge>
        </Link>
        <Link href="/dashboard/servers" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "var(--ink-muted)" }}>Servers Awaiting Reboot</span>
          <span style={{ color: summary.serversWithRebootPending > 0 ? "var(--warning)" : "var(--ink)" }}>{summary.serversWithRebootPending}</span>
        </Link>
        <Link href="/dashboard/servers" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "var(--ink-muted)" }}>Servers Not Updated (90d+)</span>
          <span style={{ color: summary.serversStale90d > 0 ? "var(--warning)" : "var(--ink)" }}>{summary.serversStale90d}</span>
        </Link>
        <Link href="/dashboard/settings" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.85rem" }}>
          <span style={{ color: "var(--ink-muted)" }}>Audit Log Entries Today</span>
          <span style={{ color: "var(--ink)" }}>{summary.auditLogCountToday}</span>
        </Link>
      </div>
    </Card>
  );
}

export function ActivityFeedCard({ entries }: { entries: ActivityFeedEntry[] }) {
  return (
    <Card className="h-full flex flex-col" hoverLift tilt3d>
      <CardHeader icon={Activity} title="Activity Feed" href="/dashboard/settings" />
      {entries.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No recent activity.</p>
      ) : (
        <div className="ov-scroll flex flex-col gap-2">
          {entries.map((e, i) => (
            <Link key={i} href="/dashboard/settings" className="ov-row-link" style={{ fontSize: "0.8125rem" }}>
              <div style={{ color: "var(--ink)" }}>
                <strong>{e.username ?? "System"}</strong> {e.action} <span style={{ color: "var(--ink-muted)" }}>in {e.section}</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{new Date(e.createdAt).toLocaleString()}</div>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Every href below is a real, existing destination in this app (verified against
// src/lib/navRoutes.ts) - not a placeholder. A few (Add User, Reset Password, View Logs) land
// on the Company Settings page generally rather than a specific tab, since those actions live
// inside tabs there that aren't individually URL-addressable - still a real, working
// destination, just not a deep link to the exact tab.
const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add User", href: "/dashboard/settings", icon: UserPlus },
  { label: "Reset Password", href: "/dashboard/settings", icon: KeyRound },
  { label: "Add Device", href: "/dashboard/servers/add", icon: PlusCircle },
  { label: "Add Website", href: "/dashboard/audit/websites", icon: Globe2 },
  { label: "Add API Monitor", href: "/dashboard/monitoring/api", icon: Wifi },
  { label: "Start Remote Session", href: "/dashboard/remote-access/quick-connect", icon: Zap },
  { label: "Block IP", href: "/dashboard/security", icon: ShieldOff },
  { label: "Create Firewall Rule", href: "/dashboard/security-center/waf", icon: Shield },
  { label: "Upload Asset", href: "/dashboard/it-assets/assets", icon: Upload },
  { label: "Run Automation", href: "/dashboard/automation/tasks", icon: PlayCircle },
  { label: "View Logs", href: "/dashboard/settings", icon: ScrollText },
];

export function QuickActionsCard() {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Zap} title="Quick Actions" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center justify-center gap-1.5"
            style={{
              padding: "0.7rem 0.5rem",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--surface-2)",
              color: "var(--ink)",
              textDecoration: "none",
              textAlign: "center",
              fontSize: "0.75rem",
            }}
          >
            <action.icon size={18} style={{ color: "var(--primary)" }} />
            {action.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

export function NotificationsCard({ summary }: { summary: NotificationsSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
        <KeyRound size={17} style={{ color: "var(--primary)" }} />
        <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>Notifications</h2>
        {summary.unreadCount > 0 && <Badge tone="info">{summary.unreadCount} unread</Badge>}
      </div>
      {summary.activeMaintenanceWindows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No active maintenance windows.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {summary.activeMaintenanceWindows.map((w, i) => (
            <Link key={i} href="/dashboard/monitoring/maintenance" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.8rem" }}>
              <span style={{ color: "var(--ink)" }}>{w.name}</span>
              <span style={{ color: "var(--ink-muted)" }}>{new Date(w.startsAt).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function WelcomeCard({ username }: { username: string | null }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <Card className="h-full flex items-center justify-between gap-4 flex-wrap" hoverLift tilt3d>
      <div className="flex items-center gap-3">
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 13,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            background: "color-mix(in srgb, var(--primary) 16%, transparent)",
            color: "var(--primary)",
          }}
        >
          <Sunrise size={22} />
        </div>
        <div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, margin: 0, color: "var(--ink)" }}>
            {greeting}
            {username ? `, ${username}` : ""} <span aria-hidden>👋</span>
          </h2>
          <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", margin: "0.2rem 0 0" }}>
            Here&apos;s what&apos;s happening across your organization today.
          </p>
        </div>
      </div>
      <div
        style={{
          fontSize: "0.82rem",
          color: "var(--ink-secondary)",
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "0.5rem 0.85rem",
          whiteSpace: "nowrap",
        }}
      >
        {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
      </div>
    </Card>
  );
}

export function PatchStatusCard({ summary }: { summary: PatchStatusSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={Wrench} title="Patch Status" href="/dashboard/it-assets/patches" />
      <div className="ov-two-col" style={{ gap: 12 }}>
        <StatTile
          label="Critical Patches Pending"
          value={summary.criticalPatchesPending}
          tone={summary.criticalPatchesPending > 0 ? "danger" : "success"}
          href="/dashboard/it-assets/patches"
        />
        <StatTile
          label="Failed Installations"
          value={summary.failedPatchInstallations}
          tone={summary.failedPatchInstallations > 0 ? "warning" : "success"}
          href="/dashboard/it-assets/patches"
        />
        <StatTile
          label="Servers Awaiting Reboot"
          value={summary.serversWithRebootPending}
          tone={summary.serversWithRebootPending > 0 ? "warning" : "success"}
          href="/dashboard/servers"
        />
      </div>
    </Card>
  );
}

export function RecentIncidentsCard({ incidents }: { incidents: RecentIncident[] }) {
  return (
    <Card className="h-full flex flex-col" hoverLift tilt3d>
      <CardHeader icon={Siren} title="Status History" href="/dashboard/monitoring/incidents" />
      {incidents.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No incidents recorded.</p>
      ) : (
        <div className="ov-scroll flex flex-col gap-2">
          {incidents.map((inc, i) => (
            <Link key={i} href="/dashboard/monitoring/incidents" className="ov-row-link flex items-center justify-between" style={{ fontSize: "0.8125rem" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.title}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{new Date(inc.startedAt).toLocaleString()}</div>
              </div>
              <Badge tone={inc.severity === "Critical" || inc.severity === "High" ? "danger" : inc.status === "Resolved" || inc.status === "Closed" ? "success" : "warning"}>
                {inc.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

export function NetworkFirewallCard({ summary }: { summary: NetworkFirewallSummary }) {
  return (
    <Card className="h-full" hoverLift tilt3d>
      <CardHeader icon={ShieldOff} title="Firewall Status" href="/dashboard/security-center" />
      <div className="ov-two-col" style={{ gap: 12, marginBottom: summary.devicesOff.length > 0 ? "0.75rem" : 0 }}>
        <StatTile label="Firewall On" value={summary.firewallOn} tone="success" href="/dashboard/security-center" />
        <StatTile label="Firewall Off" value={summary.firewallOff} tone={summary.firewallOff > 0 ? "danger" : "success"} href="/dashboard/security-center" />
      </div>
      {summary.devicesOff.length > 0 && (
        <div className="flex flex-col gap-1">
          {summary.devicesOff.map((d, i) => (
            <Link key={i} href="/dashboard/security-center" className="ov-row-link" style={{ fontSize: "0.8rem", color: "var(--ink)" }}>
              {d.deviceName ?? d.hostname}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

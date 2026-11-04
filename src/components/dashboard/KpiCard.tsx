import Link from "next/link";
import { ArrowUp, ArrowDown, Minus, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Sparkline, type SparklinePoint } from "@/components/ui/Sparkline";

export type KpiStatus = "good" | "warning" | "serious" | "critical" | "unknown";

const STATUS_COLOR: Record<KpiStatus, string> = {
  good: "var(--success)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--danger)",
  unknown: "var(--ink-muted)",
};

interface KpiCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  sub?: string;
  status: KpiStatus;
  trendPct?: number | null; // positive = up, negative = down, null = no trend data
  sparkline?: SparklinePoint[];
  href?: string;
}

export function KpiCard({ icon: Icon, title, value, sub, status, trendPct, sparkline, href }: KpiCardProps) {
  const color = STATUS_COLOR[status];
  const TrendIcon = trendPct == null || Math.abs(trendPct) < 0.05 ? Minus : trendPct > 0 ? ArrowUp : ArrowDown;
  const trendColor = trendPct == null ? "var(--ink-muted)" : trendPct > 0 ? "var(--danger)" : "var(--success)";

  const card = (
    <Card
      hoverLift
      tilt3d
      className="flex flex-col gap-3"
      style={{ cursor: href ? "pointer" : undefined }}
    >
      <div className="flex items-center justify-between">
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${color} 16%, transparent)`,
            color,
            flexShrink: 0,
          }}
        >
          <Icon size={18} />
        </div>
        {trendPct != null && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              fontSize: "0.72rem",
              fontWeight: 700,
              color: trendColor,
              background: `color-mix(in srgb, ${trendColor} 14%, transparent)`,
              borderRadius: 999,
              padding: "0.15rem 0.5rem",
            }}
          >
            <TrendIcon size={11} />
            {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: "1.9rem", fontWeight: 800, lineHeight: 1.1, color: "var(--ink)" }}>{value}</div>
        <div style={{ color: "var(--ink-muted)", fontSize: "0.8rem", marginTop: "0.2rem" }}>{title}</div>
      </div>
      {sub && <div style={{ fontSize: "0.78rem", color: "var(--ink-secondary)" }}>{sub}</div>}

      <Sparkline data={sparkline ?? []} color={color} />
    </Card>
  );

  if (!href) return card;
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block" }}>
      {card}
    </Link>
  );
}

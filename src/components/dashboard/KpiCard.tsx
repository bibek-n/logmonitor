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
      style={{
        borderTop: `2px solid ${color}`,
        cursor: href ? "pointer" : undefined,
        backgroundImage: `linear-gradient(165deg, color-mix(in srgb, ${color} 7%, transparent), transparent 55%)`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: "var(--ink-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.03em" }}>
          <Icon size={15} style={{ color }} />
          {title}
        </div>
        {trendPct != null && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: "0.75rem", color: trendColor }}>
            <TrendIcon size={12} />
            {Math.abs(trendPct).toFixed(1)}%
          </span>
        )}
      </div>

      <div
        style={{
          fontSize: "1.9rem",
          fontWeight: 700,
          lineHeight: 1.1,
          backgroundImage: `linear-gradient(135deg, var(--ink), color-mix(in srgb, ${color} 55%, var(--ink)))`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {value}
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

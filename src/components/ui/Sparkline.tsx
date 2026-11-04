"use client";

import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

export interface SparklinePoint {
  value: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  color?: string;
  height?: number;
  unit?: string;
}

function SparkTooltip({ active, payload, unit }: { active?: boolean; payload?: { value: number }[]; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--ink)",
        color: "var(--surface)",
        fontSize: "0.72rem",
        fontWeight: 600,
        padding: "0.2rem 0.5rem",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        whiteSpace: "nowrap",
      }}
    >
      {payload[0].value.toLocaleString()}
      {unit ?? ""}
    </div>
  );
}

// Tiny trend chart embedded in a KPI card - a shape with no axes/grid, but hoverable so the
// underlying numbers behind the shape aren't just decorative. Needs at least 2 points to draw
// a line; renders a flat placeholder dash otherwise rather than an empty box, since a KPI
// whose history hasn't accumulated yet is a normal, expected state.
export function Sparkline({ data, color = "var(--primary)", height = 36, unit }: SparklineProps) {
  if (data.length < 2) {
    return (
      <div style={{ height, display: "flex", alignItems: "center" }}>
        <div style={{ width: "100%", height: 1.5, background: "var(--border)" }} />
      </div>
    );
  }

  const gradientId = `spark-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={<SparkTooltip unit={unit} />}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "3 3" }}
            wrapperStyle={{ outline: "none" }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            activeDot={{ r: 3, fill: color, stroke: "var(--surface)", strokeWidth: 1.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

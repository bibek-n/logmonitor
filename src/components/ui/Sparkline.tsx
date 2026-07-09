"use client";

import { AreaChart, Area, ResponsiveContainer } from "recharts";

export interface SparklinePoint {
  value: number;
}

interface SparklineProps {
  data: SparklinePoint[];
  color?: string;
  height?: number;
}

// Tiny trend chart embedded in a KPI card — no axes/grid/tooltip, just a shape. Needs at
// least 2 points to draw a line; renders a flat placeholder dash otherwise rather than an
// empty box, since a KPI whose history hasn't accumulated yet is a normal, expected state.
export function Sparkline({ data, color = "var(--primary)", height = 36 }: SparklineProps) {
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
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

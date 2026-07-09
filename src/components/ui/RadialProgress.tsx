"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

interface RadialProgressProps {
  percent: number; // 0-100
  color?: string;
  size?: number;
  label?: string;
}

// Circular progress ring for the Device Status summary cards (Online %, Offline %, etc.).
// Fixed pixel size rather than ResponsiveContainer since it's a small decorative element
// inside a fixed-size card, not something that needs to reflow with its container.
export function RadialProgress({ percent, color = "var(--primary)", size = 76, label }: RadialProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const data = [{ value: clamped, fill: color }];

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <RadialBarChart
        width={size}
        height={size}
        cx="50%"
        cy="50%"
        innerRadius="72%"
        outerRadius="100%"
        barSize={size * 0.14}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar background={{ fill: "var(--border)" }} dataKey="value" cornerRadius={size} isAnimationActive={false} />
      </RadialBarChart>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: size * 0.24, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>
          {Math.round(clamped)}%
        </span>
        {label && <span style={{ fontSize: size * 0.11, color: "var(--ink-muted)", marginTop: 2 }}>{label}</span>}
      </div>
    </div>
  );
}

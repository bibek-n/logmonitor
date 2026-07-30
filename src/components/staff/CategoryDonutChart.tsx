"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

export interface CategoryDatum {
  name: string;
  value: number;
}

// Fixed hue order, not cycled - validated with the dataviz skill's palette checker against
// this app's actual theme surfaces (both midnight/dark and light passed CVD separation and
// normal-vision distinguishability once ordered this way; --ink-muted deliberately isn't in
// this rotation - its low chroma reads as gray by design, which is exactly right for a
// dedicated "Other" bucket rather than a real category needing to stay visually distinct).
const SLICE_COLORS = ["var(--danger)", "var(--success)", "var(--primary)", "var(--warning)", "var(--info)"];
const OTHER_COLOR = "var(--ink-muted)";
const MAX_SLICES = 5;
const OTHER_LABEL = "Other";

// Folds anything past the top MAX_SLICES into a single "Other" bucket rather than cycling
// colors indefinitely - Category/destination values here are freeform (Sophos's own text,
// or reverse-DNS hostnames), so a long tail of one-off values is the common case, and an
// unbounded legend would be unreadable anyway.
function topNPlusOther(data: CategoryDatum[], max: number): CategoryDatum[] {
  const sorted = [...data].sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const top = sorted.slice(0, max);
  const otherTotal = sorted.slice(max).reduce((sum, d) => sum + d.value, 0);
  return otherTotal > 0 ? [...top, { name: OTHER_LABEL, value: otherTotal }] : top;
}

export function CategoryDonutChart({
  title,
  data,
  emptyMessage,
}: {
  title: string;
  data: CategoryDatum[];
  emptyMessage: string;
}) {
  const filtered = data.filter((d) => d.value > 0);
  const chartData = topNPlusOther(filtered, MAX_SLICES);
  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  if (chartData.length === 0) {
    return <p style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>{emptyMessage}</p>;
  }

  return (
    <div>
      <h3 style={{ fontSize: "0.85rem", margin: "0 0 0.5rem", color: "var(--ink)" }}>{title}</h3>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
              {chartData.map((d, i) => (
                <Cell key={d.name} fill={d.name === OTHER_LABEL ? OTHER_COLOR : SLICE_COLORS[i % SLICE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", fontSize: "0.75rem" }}
              formatter={(value, name) => {
                const numeric = typeof value === "number" ? value : Number(value) || 0;
                return [`${numeric} (${((numeric / total) * 100).toFixed(0)}%)`, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "0.72rem" }}
              formatter={(value: string) => {
                const d = chartData.find((c) => c.name === value);
                const pct = d ? ((d.value / total) * 100).toFixed(0) : "0";
                return `${value} (${pct}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

interface Point {
  date: string;
  score: number;
}

function riskColor(score: number): string {
  if (score < 40) return "var(--danger)";
  if (score < 60) return "var(--warning)";
  if (score < 80) return "var(--info)";
  return "var(--success)";
}

// Fed straight from the Scan History table already on this page (ScanDate/SecurityScore) -
// no new query. Needs 2+ completed scans to draw a meaningful line; a single point still
// renders as a flat chart rather than being hidden, since "only one scan so far" is a normal
// state here (not every website has run daily for 10 days yet).
export function ScoreTrendChart({ history }: { history: { ScanDate: string; SecurityScore: number | null }[] }) {
  const points: Point[] = history
    .filter((h) => h.SecurityScore !== null)
    .map((h) => ({ date: new Date(h.ScanDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }), score: h.SecurityScore as number }))
    .reverse();

  if (points.length === 0) return null;

  const latest = points[points.length - 1].score;

  return (
    <div style={{ height: 160, marginBottom: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} width={28} />
          <ReferenceLine y={80} stroke="var(--success)" strokeDasharray="2 2" strokeOpacity={0.4} />
          <ReferenceLine y={40} stroke="var(--danger)" strokeDasharray="2 2" strokeOpacity={0.4} />
          <Tooltip
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "var(--ink-muted)" }}
          />
          <Line type="monotone" dataKey="score" stroke={riskColor(latest)} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

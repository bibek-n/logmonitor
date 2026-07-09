"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/Card";

export interface BandwidthDatum {
  t: string;
  rx: number;
  tx: number;
}

export type BandwidthRange = "1H" | "6H" | "24H" | "7D" | "30D";

const RANGES: BandwidthRange[] = ["1H", "6H", "24H", "7D", "30D"];

function formatTick(range: BandwidthRange, iso: string): string {
  const d = new Date(iso);
  if (range === "1H" || range === "6H") return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (range === "24H") return d.toLocaleTimeString(undefined, { hour: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface BandwidthPanelProps {
  data: Record<BandwidthRange, BandwidthDatum[]>;
  sparseRanges: BandwidthRange[]; // ranges where retention doesn't actually cover the full window
}

export function BandwidthPanel({ data, sparseRanges }: BandwidthPanelProps) {
  const [range, setRange] = useState<BandwidthRange>("24H");
  const points = data[range];
  const isSparse = sparseRanges.includes(range);

  return (
    <Card className="col-span-full">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>Bandwidth Analytics</h2>
          <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: "0.2rem 0 0" }}>
            WLAN interface (Port2) upload/download rate over time
            {isSparse && " — monitoring history doesn't cover this full window yet, showing what's retained"}
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: "0.35rem 0.7rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: r === range ? "var(--primary)" : "var(--surface-2)",
                color: r === range ? "#fff" : "var(--ink-secondary)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {points.length < 2 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Not enough data yet for this range.</p>
      ) : (
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="bwRx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bwTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={(v) => formatTick(range, v)}
                stroke="var(--ink-muted)"
                fontSize={11}
                tickLine={false}
              />
              <YAxis stroke="var(--ink-muted)" fontSize={11} tickLine={false} width={40} unit=" Mbps" />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: "0.8rem" }}
                labelFormatter={(v) => new Date(v).toLocaleString()}
              />
              <Legend wrapperStyle={{ fontSize: "0.78rem" }} />
              <Area type="monotone" dataKey="rx" name="Download" stroke="var(--primary)" fill="url(#bwRx)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="tx" name="Upload" stroke="var(--success)" fill="url(#bwTx)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

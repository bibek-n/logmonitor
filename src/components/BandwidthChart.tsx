export interface BandwidthPoint {
  t: string;
  rx: number;
  tx: number;
}

export default function BandwidthChart({
  points,
  height = 200,
  unit = "MB",
}: {
  points: BandwidthPoint[];
  height?: number;
  unit?: string;
}) {
  if (points.length < 2) {
    return (
      <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>
        Not enough data yet to draw a chart — check back after a few more readings.
      </p>
    );
  }

  const width = 640;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(...points.map((p) => Math.max(p.rx, p.tx)), 0.001);
  const x = (i: number) => padL + (i / (points.length - 1)) * plotW;
  const y = (v: number) => padT + plotH - (v / maxVal) * plotH;

  const rxPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.rx).toFixed(1)}`).join(" ");
  const txPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.tx).toFixed(1)}`).join(" ");

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ maxWidth: width }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={width - padR}
            y1={padT + plotH * f}
            y2={padT + plotH * f}
            stroke="var(--grid)"
            strokeWidth={1}
          />
        ))}
        <text x={2} y={padT + 4} fontSize="9" fill="var(--ink-muted)">
          {maxVal.toFixed(1)} {unit}
        </text>
        <text x={2} y={padT + plotH + 4} fontSize="9" fill="var(--ink-muted)">
          0
        </text>
        <path d={rxPath} fill="none" stroke="var(--series-1)" strokeWidth={1.5} />
        <path d={txPath} fill="none" stroke="var(--series-2)" strokeWidth={1.5} />
      </svg>
      <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--ink-secondary)", marginTop: "0.25rem" }}>
        <span>
          <span style={{ color: "var(--series-1)" }}>&#9632;</span> Received
        </span>
        <span>
          <span style={{ color: "var(--series-2)" }}>&#9632;</span> Transmitted
        </span>
        <span>
          {new Date(points[0].t).toLocaleTimeString()} &ndash; {new Date(points[points.length - 1].t).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}

export function kbitsToMB(kbits: number): number {
  return (kbits * 1000) / 8 / 1_000_000;
}

export function kbitsToMbps(kbits: number): number {
  return kbits / 1000;
}

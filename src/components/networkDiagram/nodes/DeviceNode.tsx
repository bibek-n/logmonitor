import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ICONS, type IconKey } from "@/lib/networkDiagram";

export interface DeviceNodeData {
  iconKey: IconKey;
  title: string;
  subtitle?: string;
  tone?: "default" | "firewall";
  [key: string]: unknown;
}

const SIDES: { side: "top" | "bottom" | "left" | "right"; position: Position }[] = [
  { side: "top", position: Position.Top },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
];

const handleStyle = { width: 8, height: 8, background: "var(--primary)", border: "1px solid var(--surface)" };

export function DeviceNode({ data, selected }: NodeProps & { data: DeviceNodeData }) {
  const Icon = ICONS[data.iconKey];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: `1px solid ${selected ? "var(--primary)" : data.tone === "firewall" ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 10,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        textAlign: "center",
        padding: "0 6px",
        boxShadow: selected ? "0 0 0 2px var(--primary)" : "0 1px 2px rgba(0,0,0,0.06)",
        cursor: "pointer",
      }}
    >
      {SIDES.map(({ side, position }) => (
        <div key={side}>
          <Handle type="target" position={position} id={`${side}-target`} style={handleStyle} />
          <Handle type="source" position={position} id={`${side}-source`} style={handleStyle} />
        </div>
      ))}
      <Icon size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{data.title}</span>
      {data.subtitle && (
        <span style={{ fontSize: 10, color: "var(--ink-muted)", lineHeight: 1.2, fontFamily: "monospace" }}>
          {data.subtitle}
        </span>
      )}
    </div>
  );
}

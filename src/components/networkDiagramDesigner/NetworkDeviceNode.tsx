import { Handle, Position, type NodeProps } from "@xyflow/react";
import { getDeviceIcon } from "@/lib/networkDiagramDesigner/deviceLibrary";
import type { NetworkDiagramNodeData } from "@/lib/networkDiagramDesigner/types";

const SIDES: { side: "top" | "bottom" | "left" | "right"; position: Position }[] = [
  { side: "top", position: Position.Top },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
  { side: "right", position: Position.Right },
];

const handleStyle = { width: 8, height: 8, background: "var(--primary)", border: "1px solid var(--surface)" };

const STATUS_COLOR: Record<string, string> = {
  active: "var(--success)",
  inactive: "var(--ink-muted)",
  maintenance: "var(--warning)",
  planned: "var(--info)",
  decommissioned: "var(--danger)",
};

export function NetworkDeviceNode({ data, selected, width, height }: NodeProps & { data: NetworkDiagramNodeData }) {
  const Icon = getDeviceIcon(data.deviceType);
  const statusColor = data.status ? STATUS_COLOR[data.status] : undefined;

  return (
    <div
      style={{
        width: width ?? 140,
        height: height ?? 64,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        padding: "6px 10px",
        borderRadius: 10,
        background: "var(--surface)",
        border: selected ? "2px solid var(--primary)" : "1px solid var(--border)",
        boxShadow: selected ? "0 0 0 2px color-mix(in srgb, var(--primary) 30%, transparent)" : "none",
        position: "relative",
      }}
    >
      {SIDES.map(({ side, position }) => (
        <div key={side}>
          <Handle type="target" position={position} id={`${side}-target`} style={handleStyle} />
          <Handle type="source" position={position} id={`${side}-source`} style={handleStyle} />
        </div>
      ))}

      {statusColor && (
        <span
          style={{
            position: "absolute", top: 6, right: 6, width: 7, height: 7,
            borderRadius: "50%", background: statusColor,
          }}
          title={data.status}
        />
      )}

      <Icon size={20} style={{ color: "var(--primary)", flexShrink: 0 }} />
      <span
        style={{
          fontSize: 12, fontWeight: 600, color: "var(--ink)", textAlign: "center",
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {data.label}
      </span>
      {data.hostname && (
        <span
          style={{
            fontSize: 10, color: "var(--ink-muted)", fontFamily: "monospace",
            maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          {data.hostname}
        </span>
      )}
    </div>
  );
}

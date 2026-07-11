import { NodeResizer, type NodeProps } from "@xyflow/react";

export interface ZoneNodeData {
  label: string;
  [key: string]: unknown;
}

export function ZoneNode({ data, selected }: NodeProps & { data: ZoneNodeData }) {
  return (
    <>
      <NodeResizer isVisible={selected} minWidth={120} minHeight={80} lineStyle={{ borderColor: "var(--primary)" }} handleStyle={{ width: 8, height: 8 }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          border: "1px dashed var(--border)",
          borderRadius: 12,
          background: "var(--surface-2)",
          cursor: "pointer",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -11,
            left: 16,
            background: "var(--surface)",
            padding: "0 8px",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-muted)",
            letterSpacing: "0.02em",
          }}
        >
          {data.label}
        </span>
      </div>
    </>
  );
}

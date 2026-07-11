import { ICONS, type DiagramDoc, type DiagramEdge, type DiagramNode } from "@/lib/networkDiagram";

function nodeCenter(node: DiagramNode) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function edgeAnchor(node: DiagramNode, side: DiagramEdge["sourceHandle"]) {
  switch (side) {
    case "top":
      return { x: node.x + node.w / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.w / 2, y: node.y + node.h };
    case "left":
      return { x: node.x, y: node.y + node.h / 2 };
    case "right":
      return { x: node.x + node.w, y: node.y + node.h / 2 };
    default:
      return nodeCenter(node);
  }
}

function Connectors({ diagram }: { diagram: DiagramDoc }) {
  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  return (
    <svg
      width={diagram.canvas.width}
      height={diagram.canvas.height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      aria-hidden="true"
    >
      {diagram.edges.map((e) => {
        const source = byId.get(e.source);
        const target = byId.get(e.target);
        if (!source || !target) return null;
        const from = edgeAnchor(source, e.sourceHandle);
        const to = edgeAnchor(target, e.targetHandle);
        return (
          <line
            key={e.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--primary)"
            strokeWidth={2}
            strokeDasharray={e.dashed ? "6 5" : undefined}
          />
        );
      })}
    </svg>
  );
}

function ZoneBox({ x, y, w, h, label }: { x: number; y: number; w: number; h: number; label: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        border: "1px dashed var(--border)",
        borderRadius: 12,
        background: "var(--surface-2)",
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
        {label}
      </span>
    </div>
  );
}

function NodeBox({ node }: { node: DiagramNode }) {
  const Icon = ICONS[node.iconKey];
  return (
    <div
      style={{
        position: "absolute",
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        border: `1px solid ${node.tone === "firewall" ? "var(--primary)" : "var(--border)"}`,
        borderRadius: 10,
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        textAlign: "center",
        padding: "0 6px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      <Icon size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{node.title}</span>
      {node.subtitle && (
        <span style={{ fontSize: 10, color: "var(--ink-muted)", lineHeight: 1.2, fontFamily: "monospace" }}>
          {node.subtitle}
        </span>
      )}
    </div>
  );
}

function Note({
  x,
  y,
  w,
  text,
  align = "center",
  iconKey,
}: {
  x: number;
  y: number;
  w: number;
  text: string;
  align?: "left" | "center" | "right";
  iconKey?: DiagramNode["iconKey"];
}) {
  const Icon = iconKey ? ICONS[iconKey] : null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        fontSize: 11,
        color: "var(--ink-secondary)",
        textAlign: align,
        lineHeight: 1.35,
        display: Icon ? "flex" : undefined,
        alignItems: Icon ? "center" : undefined,
        gap: Icon ? 6 : undefined,
      }}
    >
      {Icon && <Icon size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />}
      <span>{text}</span>
    </div>
  );
}

export function DiagramView({ diagram }: { diagram: DiagramDoc }) {
  return (
    <div style={{ position: "relative", width: diagram.canvas.width, height: diagram.canvas.height }}>
      <Connectors diagram={diagram} />
      {diagram.zones.map((z) => (
        <ZoneBox key={z.id} x={z.x} y={z.y} w={z.w} h={z.h} label={z.label} />
      ))}
      {diagram.nodes.map((n) => (
        <NodeBox key={n.id} node={n} />
      ))}
      {diagram.notes.map((n) => (
        <Note key={n.id} x={n.x} y={n.y} w={n.w} text={n.text} align={n.align} iconKey={n.iconKey} />
      ))}
    </div>
  );
}

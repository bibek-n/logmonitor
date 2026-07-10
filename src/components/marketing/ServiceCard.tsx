import { resolveIcon } from "./icons";
import { MKT } from "@/lib/marketingTheme";
import type { ServiceItem } from "@/lib/websiteContent";

export function ServiceCard({ service }: { service: ServiceItem }) {
  const Icon = resolveIcon(service.icon);
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${MKT.border}`,
        borderRadius: 12,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "color-mix(in srgb, " + MKT.primary + " 12%, white)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} style={{ color: MKT.primary }} />
      </div>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: MKT.ink, margin: 0 }}>{service.title}</h3>
      <p style={{ fontSize: "0.9rem", color: MKT.inkMuted, margin: 0, lineHeight: 1.55 }}>{service.description}</p>
    </div>
  );
}

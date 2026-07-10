import { resolveIcon } from "./icons";
import { MKT } from "@/lib/marketingTheme";

export function WhyChooseUsCard({ icon, title }: { icon: string; title: string }) {
  const Icon = resolveIcon(icon);
  return (
    <div
      className="flex items-center gap-3"
      style={{ background: MKT.surface, border: `1px solid ${MKT.border}`, borderRadius: 10, padding: "1rem 1.1rem" }}
    >
      <Icon size={20} style={{ color: MKT.primary, flexShrink: 0 }} />
      <span style={{ fontSize: "0.9rem", fontWeight: 600, color: MKT.ink }}>{title}</span>
    </div>
  );
}

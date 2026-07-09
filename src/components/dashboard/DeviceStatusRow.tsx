import { RadialProgress } from "@/components/ui/RadialProgress";
import { Card } from "@/components/ui/Card";

interface DeviceStatusRowProps {
  total: number;
  online: number;
  offline: number;
  attention: number;
}

export function DeviceStatusRow({ total, online, offline, attention }: DeviceStatusRowProps) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  const cards = [
    { label: "Total Devices", value: total, pct: 100, color: "var(--primary)" },
    { label: "Online", value: online, pct: pct(online), color: "var(--success)" },
    { label: "Offline", value: offline, pct: pct(offline), color: "var(--ink-muted)" },
    { label: "Needs Attention", value: attention, pct: pct(attention), color: "var(--danger)" },
  ];

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {cards.map((c) => (
        <Card key={c.label} hoverLift className="flex items-center gap-4">
          <RadialProgress percent={c.pct} color={c.color} size={68} />
          <div>
            <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--ink)" }}>{c.value}</div>
            <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{c.label}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

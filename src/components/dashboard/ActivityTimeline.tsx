import Link from "next/link";
import { AlertTriangle, UserCheck, UserX, Wifi } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface TimelineEvent {
  time: string;
  label: string;
  kind: "alert" | "staff-online" | "staff-offline";
}

const ICON = { alert: AlertTriangle, "staff-online": UserCheck, "staff-offline": UserX };
const COLOR = { alert: "var(--warning)", "staff-online": "var(--success)", "staff-offline": "var(--ink-muted)" };

export function ActivityTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <Card className="h-full flex flex-col" hoverLift tilt3d>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.9rem" }}>
        <h2 style={{ fontSize: "1.125rem", margin: 0, color: "var(--ink)" }}>System Logs</h2>
        <Link href="/dashboard/staff" style={{ color: "var(--primary)", fontSize: "0.78rem", textDecoration: "none" }}>
          View all &rarr;
        </Link>
      </div>
      {events.length === 0 ? (
        <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No recent activity.</p>
      ) : (
        <div className="ov-scroll" style={{ position: "relative", paddingLeft: "1.5rem" }}>
          <div style={{ position: "absolute", left: 7, top: 4, bottom: 4, width: 2, background: "var(--border)" }} />
          {events.map((e, i) => {
            const Icon = ICON[e.kind] ?? Wifi;
            return (
              <div key={i} style={{ position: "relative", paddingBottom: i === events.length - 1 ? 0 : "1rem" }}>
                <div
                  style={{
                    position: "absolute",
                    left: "-1.5rem",
                    top: 0,
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    background: "var(--surface)",
                    border: `2px solid ${COLOR[e.kind]}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={9} style={{ color: COLOR[e.kind] }} />
                </div>
                <Link href="/dashboard/staff" className="ov-row-link">
                  <div style={{ fontSize: "0.82rem", color: "var(--ink)" }}>{e.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{new Date(e.time).toLocaleString()}</div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, MonitorPlay, Eye } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { RequestSessionModal } from "./RequestSessionModal";

export interface RemoteSupportDevice {
  deviceId: string;
  hostname: string;
  department: string | null;
  staffId: number | null;
  staffName: string | null;
  status: "Online" | "Offline" | "InSession";
  activeSessionId: number | null;
}

const STATUS_TONE: Record<RemoteSupportDevice["status"], "success" | "neutral" | "warning"> = {
  Online: "success",
  Offline: "neutral",
  InSession: "warning",
};

const REFRESH_MS = 15000;

function RemoteSupportConsoleInner({ initialDevices }: { initialDevices: RemoteSupportDevice[] }) {
  const router = useRouter();
  const toast = useToast();
  const [devices, setDevices] = useState(initialDevices);
  const [search, setSearch] = useState("");
  const [requestingFor, setRequestingFor] = useState<RemoteSupportDevice | null>(null);

  // Device online/offline/in-session status changes on its own (heartbeats, other admins'
  // sessions) - a short poll keeps this list honest without needing a full page refresh.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/remote-support/devices");
        const data = await res.json();
        if (data.ok) setDevices(data.devices);
      } catch {
        // transient poll failure - try again next tick
      }
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      d.hostname.toLowerCase().includes(q) ||
      d.deviceId.toLowerCase().includes(q) ||
      (d.department ?? "").toLowerCase().includes(q) ||
      (d.staffName ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div style={{ position: "relative", maxWidth: 360, marginBottom: "1rem" }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by hostname, staff, or department..."
          style={{
            width: "100%",
            padding: "0.55rem 0.8rem 0.55rem 2.1rem",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontSize: "0.85rem",
          }}
        />
      </div>

      <Card style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Hostname", "Department", "Assigned To", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.9rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.deviceId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{d.hostname || "(unnamed)"}</td>
                  <td style={{ padding: "0.6rem 0.9rem", color: d.department ? undefined : "var(--ink-muted)" }}>
                    {d.department ?? "—"}
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", color: d.staffName ? undefined : "var(--ink-muted)" }}>
                    {d.staffName ?? "Unassigned"}
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={STATUS_TONE[d.status]}>{d.status === "InSession" ? "In Session" : d.status}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", whiteSpace: "nowrap" }}>
                    {d.status === "InSession" && d.activeSessionId ? (
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/remote-support/sessions/${d.activeSessionId}`)}>
                        <Eye size={14} /> View Session
                      </Button>
                    ) : (
                      <Button size="sm" disabled={d.status === "Offline"} onClick={() => setRequestingFor(d)}>
                        <MonitorPlay size={14} /> Request Session
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    {devices.length === 0 ? "No devices enrolled yet." : "No devices match your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {requestingFor && (
        <RequestSessionModal
          device={requestingFor}
          onClose={() => setRequestingFor(null)}
          onRequested={(sessionId) => {
            setRequestingFor(null);
            toast.show({ type: "success", message: `Session request sent to ${requestingFor.hostname}.` });
            router.push(`/dashboard/remote-support/sessions/${sessionId}`);
          }}
          onError={(message) => toast.show({ type: "error", message })}
        />
      )}
    </>
  );
}

export function RemoteSupportConsole(props: { initialDevices: RemoteSupportDevice[] }) {
  return (
    <ToastProvider>
      <RemoteSupportConsoleInner {...props} />
    </ToastProvider>
  );
}

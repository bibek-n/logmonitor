"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface Connection {
  id: number;
  name: string;
  protocol: string;
  hostname: string | null;
  ipAddress: string | null;
}

function LandingInner() {
  const toast = useToast();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [connectingId, setConnectingId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [vncRes, rdpRes] = await Promise.all([
        fetch("/api/admin/remote-access/connections?protocol=VNC"),
        fetch("/api/admin/remote-access/connections?protocol=RDP"),
      ]);
      const [vncData, rdpData] = await Promise.all([vncRes.json(), rdpRes.json()]);
      const vnc: Connection[] = vncRes.ok && vncData.ok ? vncData.data : [];
      const rdp: Connection[] = rdpRes.ok && rdpData.ok ? rdpData.data : [];
      setConnections([...vnc, ...rdp]);
    })();
  }, []);

  async function open(c: Connection) {
    setConnectingId(c.id);
    try {
      const res = await fetch(`/api/admin/remote-access/sessions/${c.protocol === "RDP" ? "rdp" : "vnc"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: c.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Failed to connect." });
        return;
      }
      router.push(`/dashboard/remote-access/remote-desktop/${data.data.sessionId}?w=${data.data.width}&h=${data.data.height}`);
    } finally {
      setConnectingId(null);
    }
  }

  return (
    <Card>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>
        Choose a saved VNC or RDP connection to open an in-browser viewer. Frames are polled a few times per second
        (this app&apos;s hosting can&apos;t run a persistent streaming connection) - fine for admin tasks, not for
        watching video.
      </p>
      {connections === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : connections.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No VNC or RDP connections saved yet.</p>
      ) : (
        connections.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.4rem 0", borderBottom: "1px solid var(--grid)" }}>
            <span>
              {c.name} <Badge tone="neutral">{c.protocol}</Badge>{" "}
              <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>({c.hostname || c.ipAddress})</span>
            </span>
            <Button size="sm" onClick={() => open(c)} disabled={connectingId === c.id}>
              {connectingId === c.id ? "Connecting..." : "Connect"}
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}

export function RemoteDesktopLandingClient() {
  return (
    <ToastProvider>
      <LandingInner />
    </ToastProvider>
  );
}

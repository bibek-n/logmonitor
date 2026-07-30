"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/remote-access/connections?protocol=SSH");
      const data = await res.json();
      if (res.ok && data.ok) setConnections(data.data);
    })();
  }, []);

  async function open(id: number) {
    const res = await fetch("/api/admin/remote-access/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectionId: id }) });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to open session." });
      return;
    }
    router.push(`/dashboard/remote-access/terminal/${data.data.sessionId}`);
  }

  return (
    <Card>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Choose a saved SSH connection to open a terminal tab, or use Quick Connect for an ad-hoc session.</p>
      {connections === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : connections.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No SSH connections saved yet.</p>
      ) : (
        connections.map((c) => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0", borderBottom: "1px solid var(--grid)" }}>
            <span>
              {c.name} <span style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>({c.hostname || c.ipAddress})</span>
            </span>
            <Button size="sm" onClick={() => open(c.id)}>
              Open Terminal
            </Button>
          </div>
        ))
      )}
    </Card>
  );
}

export function TerminalLandingClient() {
  return (
    <ToastProvider>
      <LandingInner />
    </ToastProvider>
  );
}

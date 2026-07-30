"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, RefreshCw, Star } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

export interface PhpVersionRow {
  Version: string;
  SapiCli: boolean;
  SapiFpm: boolean;
  CliErrorLogPath: string | null;
  FpmErrorLogPath: string | null;
  IsDefault: boolean;
}

type Sapi = "fpm" | "cli";

const POLL_MS = 2000;

function PhpVersionsClientInner({ deviceId, versions }: { deviceId: string; versions: PhpVersionRow[] }) {
  const toast = useToast();
  const [selected, setSelected] = useState<{ version: string; sapi: Sapi } | null>(null);
  const [pending, setPending] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => stopPolling, []);

  async function pollOnce(version: string, sapi: Sapi) {
    try {
      const res = await fetch(`/api/admin/servers/${deviceId}/php-log-content?version=${encodeURIComponent(version)}&sapi=${sapi}`);
      const data = await res.json();
      if (!data.ok) return;
      setPending(data.pending);
      setContent(data.content);
      setError(data.error);
      setFetchedAt(data.fetchedAt);
      if (!data.pending) stopPolling();
    } catch {
      // transient poll failure - try again next tick
    }
  }

  async function viewLog(version: string, sapi: Sapi) {
    stopPolling();
    setSelected({ version, sapi });
    setPending(true);
    setContent(null);
    setError(null);
    setFetchedAt(null);
    try {
      const res = await fetch(`/api/admin/servers/${deviceId}/php-log-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, sapi }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPending(false);
        toast.show({ type: "error", message: data.error ?? "Failed to request the log." });
        return;
      }
      await pollOnce(version, sapi);
      pollRef.current = setInterval(() => pollOnce(version, sapi), POLL_MS);
    } catch (err) {
      setPending(false);
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        {versions.map((v) => (
          <Card key={v.Version}>
            <div className="flex items-center gap-2" style={{ marginBottom: "0.6rem" }}>
              <h3 style={{ margin: 0, fontSize: "1rem" }}>PHP {v.Version}</h3>
              {v.IsDefault && (
                <Badge tone="info">
                  <Star size={10} /> Default
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>FPM</span>
                {v.SapiFpm ? (
                  <Button size="sm" variant="secondary" onClick={() => viewLog(v.Version, "fpm")}>
                    <FileText size={13} /> View Error Log
                  </Button>
                ) : (
                  <Badge tone="neutral">Not installed</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: "0.82rem", color: "var(--ink-muted)" }}>CLI</span>
                {v.SapiCli ? (
                  <Button size="sm" variant="secondary" onClick={() => viewLog(v.Version, "cli")}>
                    <FileText size={13} /> View Error Log
                  </Button>
                ) : (
                  <Badge tone="neutral">Not installed</Badge>
                )}
              </div>
            </div>
          </Card>
        ))}
        {versions.length === 0 && (
          <p style={{ color: "var(--ink-muted)" }}>No PHP versions detected on this server yet.</p>
        )}
      </div>

      {selected && (
        <Card style={{ padding: 0 }}>
          <div
            className="flex items-center justify-between"
            style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <strong style={{ fontSize: "0.9rem" }}>
                PHP {selected.version} — {selected.sapi.toUpperCase()} error log
              </strong>
              <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                {pending ? "Waiting for the agent's next check-in (~30s)..." : fetchedAt ? `Fetched ${fetchedAt} UTC` : ""}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => viewLog(selected.version, selected.sapi)} disabled={pending}>
              <RefreshCw size={13} /> Refresh
            </Button>
          </div>
          <div style={{ padding: "1rem", maxHeight: 480, overflow: "auto" }}>
            {pending ? (
              <p style={{ color: "var(--ink-muted)", margin: 0 }}>Loading...</p>
            ) : error ? (
              <p style={{ color: "var(--danger)", margin: 0 }}>{error}</p>
            ) : content ? (
              <pre style={{ margin: 0, fontSize: "0.78rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{content}</pre>
            ) : (
              <p style={{ color: "var(--ink-muted)", margin: 0 }}>The log file is empty.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

export function PhpVersionsClient(props: { deviceId: string; versions: PhpVersionRow[] }) {
  return (
    <ToastProvider>
      <PhpVersionsClientInner {...props} />
    </ToastProvider>
  );
}

"use client";

import { useState, useRef, FormEvent } from "react";
import BandwidthChart, { BandwidthPoint } from "./BandwidthChart";

interface ServerPreset {
  label: string;
  downloadUrl: string;
}

interface Props {
  category: "nepal" | "international" | "local-ip";
  servers?: ServerPreset[];
  freeTextLabel?: string;
  freeTextPlaceholder?: string;
}

interface PhaseState {
  mbps: number | null;
  done: boolean;
  failed: string | null;
}

const EMPTY_PHASE: PhaseState = { mbps: null, done: false, failed: null };

// Ping/download/upload each get a band of the bar; there's no real byte-level progress
// signal from the SSE stream (just periodic mbps readouts), so within a running band the
// value creeps toward - but never quite reaches - that band's upper bound, closing the gap
// a bit more with each streamed update, so it still visibly moves during a slow phase
// instead of sitting frozen between two fixed jumps.
function bumpWithinBand(start: number, end: number, ticks: number): number {
  const pct = 1 - 1 / (1 + ticks * 0.35);
  return Math.min(end - 1, start + (end - start) * pct);
}

function StatTile({ label, value, status }: { label: string; value: string; status: string }) {
  return (
    <div className={`stat-tile status-${status}`}>
      <div className="label">
        <span className={`status-dot status-${status}`} />
        {label}
      </div>
      <div className="value">{value}</div>
    </div>
  );
}

export default function SpeedTestForm({ category, servers, freeTextLabel, freeTextPlaceholder }: Props) {
  const [target, setTarget] = useState(servers?.[0]?.downloadUrl ?? "");
  const [running, setRunning] = useState(false);
  const [ping, setPing] = useState<{ avg: string; loss: number } | null>(null);
  const [pingFailed, setPingFailed] = useState<string | null>(null);
  const [download, setDownload] = useState<PhaseState>(EMPTY_PHASE);
  const [upload, setUpload] = useState<PhaseState>(EMPTY_PHASE);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<BandwidthPoint[]>([]);
  const [progress, setProgress] = useState(0);
  const lastDownloadMbps = useRef(0);
  const downloadTicks = useRef(0);
  const uploadTicks = useRef(0);

  async function run(e: FormEvent) {
    e.preventDefault();
    setRunning(true);
    setPing(null);
    setPingFailed(null);
    setDownload(EMPTY_PHASE);
    setUpload(EMPTY_PHASE);
    setError(null);
    setPoints([]);
    setProgress(4);
    lastDownloadMbps.current = 0;
    downloadTicks.current = 0;
    uploadTicks.current = 0;

    try {
      const res = await fetch("/api/speed-test/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: target.trim(), category }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Request failed (HTTP ${res.status}).`);
        return;
      }
      if (!res.body) {
        setError("No response stream received.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const evt = JSON.parse(line);

          if (evt.phase === "error") {
            setError(evt.message);
          } else if (evt.phase === "ping") {
            if (evt.status === "done") setPing({ avg: evt.avgMs, loss: evt.lossPct });
            if (evt.status === "failed") setPingFailed(evt.error);
            setProgress(15);
          } else if (evt.phase === "download") {
            if (evt.status === "failed") {
              setDownload({ mbps: null, done: true, failed: evt.error });
              setProgress(60);
            } else {
              setDownload({ mbps: evt.mbps, done: evt.status === "done", failed: null });
              lastDownloadMbps.current = evt.mbps;
              setPoints((pts) => [...pts, { t: new Date().toISOString(), rx: evt.mbps, tx: 0 }]);
              downloadTicks.current += 1;
              setProgress(evt.status === "done" ? 60 : bumpWithinBand(15, 60, downloadTicks.current));
            }
          } else if (evt.phase === "upload") {
            if (evt.status === "failed") {
              setUpload({ mbps: null, done: true, failed: evt.error });
              setProgress(100);
            } else {
              setUpload({ mbps: evt.mbps, done: evt.status === "done", failed: null });
              // Carry the download line forward as a flat reference while upload ramps up,
              // so the chart reads as one continuous timeline across both phases.
              setPoints((pts) => [...pts, { t: new Date().toISOString(), rx: lastDownloadMbps.current, tx: evt.mbps }]);
              uploadTicks.current += 1;
              setProgress(evt.status === "done" ? 100 : bumpWithinBand(60, 100, uploadTicks.current));
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setRunning(false);
    }
  }

  function phaseValue(p: PhaseState, running: boolean): string {
    if (p.failed) return "failed";
    if (p.mbps === null) return running ? "…" : "-";
    return `${p.mbps.toFixed(2)} Mbps`;
  }

  return (
    <div className="dash-panel">
      <form onSubmit={run} style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {servers ? (
          <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
            <label htmlFor="server">Server</label>
            <select
              id="server"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--plane)",
                color: "var(--ink)",
                fontSize: "0.95rem",
              }}
            >
              {servers.map((s) => (
                <option key={s.downloadUrl} value={s.downloadUrl}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
            <label htmlFor="target">{freeTextLabel ?? "Target"}</label>
            <input
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
              placeholder={freeTextPlaceholder}
            />
          </div>
        )}
        <button className="submit" type="submit" disabled={running} style={{ width: "auto", marginTop: 0, padding: "0.6rem 1.25rem" }}>
          {running ? "Testing..." : "Run Speed Test"}
        </button>
      </form>

      <div className="stat-grid" style={{ marginTop: "1rem" }}>
        <StatTile
          label="Ping"
          value={pingFailed ? "failed" : ping ? `${ping.avg} (${ping.loss}% loss)` : running ? "…" : "-"}
          status={pingFailed ? "critical" : ping ? "good" : "unknown"}
        />
        <StatTile
          label="Download"
          value={phaseValue(download, running)}
          status={download.failed ? "critical" : download.done ? "good" : download.mbps !== null ? "warning" : "unknown"}
        />
        <StatTile
          label="Upload"
          value={phaseValue(upload, running)}
          status={upload.failed ? "critical" : upload.done ? "good" : upload.mbps !== null ? "warning" : "unknown"}
        />
      </div>

      {(pingFailed || download.failed || upload.failed || error) && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error && <div>{error}</div>}
          {pingFailed && <div>Ping failed: {pingFailed}</div>}
          {download.failed && <div>Download failed: {download.failed}</div>}
          {upload.failed && <div>Upload failed: {upload.failed}</div>}
        </div>
      )}

      {points.length >= 2 && (
        <div style={{ marginTop: "1rem" }}>
          <h2 style={{ fontSize: "0.9rem", marginTop: 0, marginBottom: "0.5rem" }}>Bandwidth Usage</h2>
          <BandwidthChart points={points} unit="Mbps" />
        </div>
      )}

      {running && (
        <div style={{ marginTop: "1.25rem" }}>
          <div style={{ height: 6, borderRadius: 999, background: "var(--border)", overflow: "hidden" }}>
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "var(--primary)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.35rem", textAlign: "right" }}>
            {progress < 15 ? "Pinging..." : progress < 60 ? "Testing download..." : "Testing upload..."}
          </div>
        </div>
      )}
    </div>
  );
}

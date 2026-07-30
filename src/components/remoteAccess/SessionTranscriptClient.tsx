"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface Summary {
  id: number;
  connectionName: string | null;
  targetHost: string;
  protocol: string;
  startedByUsername: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string;
  recordingStatus: string;
}
interface TranscriptEntry {
  direction: "Input" | "Output";
  content: string;
  loggedAt: string;
}

export function SessionTranscriptClient({ sessionId }: { sessionId: number }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/remote-access/sessions/${sessionId}/transcript`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Failed to load transcript.");
        return;
      }
      setSummary(data.data.summary);
      setTranscript(data.data.transcript);
    })();
  }, [sessionId]);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!summary || !transcript) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  // Output is rendered raw (the terminal's own ANSI escapes strip out as literal bytes here -
  // this is a plain-text transcript, not a full terminal re-render); input keystrokes are shown
  // as a distinct color so a reviewer can tell what was typed apart from what came back.
  const body = transcript.map((entry, i) => (
    <span key={i} style={{ color: entry.direction === "Input" ? "#7ee787" : "#d1f7c4" }}>
      {entry.content}
    </span>
  ));

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <strong>{summary.connectionName ?? "(ad-hoc)"}</strong>
          <span style={{ color: "var(--ink-muted)" }}>{summary.targetHost}</span>
          <Badge tone="neutral">{summary.protocol}</Badge>
          <Badge tone={summary.status === "Active" ? "info" : "neutral"}>{summary.status}</Badge>
          <span style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
            {summary.startedByUsername} &middot; {new Date(summary.startedAt).toLocaleString()}
            {summary.endedAt ? ` – ${new Date(summary.endedAt).toLocaleString()}` : ""}
          </span>
        </div>
      </Card>

      <div
        style={{
          background: "#0b0f14",
          color: "#d1f7c4",
          fontFamily: "monospace",
          fontSize: "0.82rem",
          padding: "1rem",
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        {transcript.length === 0 ? <span style={{ color: "var(--ink-muted)" }}>No recorded output for this session.</span> : body}
      </div>
    </div>
  );
}

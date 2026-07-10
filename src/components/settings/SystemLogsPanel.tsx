"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function SystemLogsPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings/system/logs");
      const data = await res.json();
      if (data.ok) {
        setLines(data.data.lines);
        setFileName(data.data.fileName);
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-system-logs">
      <div className="flex items-center justify-between">
        <h3 style={{ fontSize: "0.95rem", margin: 0, color: "var(--ink)" }}>System Logs</h3>
        <Button size="sm" variant="secondary" onClick={load} disabled={loading}>
          {loading ? "Loading..." : loaded ? "Refresh" : "Load Recent Logs"}
        </Button>
      </div>
      {fileName && <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>Source: {fileName}</p>}
      {loaded && (
        <pre
          style={{
            margin: 0,
            maxHeight: 320,
            overflow: "auto",
            fontSize: "0.72rem",
            lineHeight: 1.5,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.75rem",
            whiteSpace: "pre-wrap",
            color: "var(--ink-secondary)",
          }}
        >
          {lines.length > 0 ? lines.join("\n") : "No recent log entries found."}
        </pre>
      )}
    </Card>
  );
}

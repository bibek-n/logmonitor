"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

interface TokenRow {
  Id: number;
  Token: string;
  CreatedAt: string;
  ExpiresAt: string;
  UsedAt: string | null;
  UsedByDeviceId: string | null;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.75rem",
        fontSize: "0.78rem",
        overflowX: "auto",
        margin: 0,
      }}
    >
      {children}
    </pre>
  );
}

export function EnrollClient({ existingTokens }: { existingTokens: TokenRow[] }) {
  const [generating, setGenerating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [tokens, setTokens] = useState(existingTokens);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/enrollment-tokens", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setNewToken({ token: data.token, expiresAt: data.expiresAt });
        setTokens((prev) => [
          { Id: -1, Token: data.token, CreatedAt: new Date().toISOString(), ExpiresAt: data.expiresAt, UsedAt: null, UsedByDeviceId: null },
          ...prev,
        ]);
      }
    } finally {
      setGenerating(false);
    }
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://logs.tulipshrm.com:4433";

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <Button onClick={generate} disabled={generating} style={{ alignSelf: "flex-start" }}>
          {generating ? "Generating..." : "Generate enrollment token"}
        </Button>

        {newToken && (
          <div className="flex flex-col gap-3">
            <div style={{ fontSize: "0.82rem", color: "var(--ink-secondary)" }}>
              Token (expires {new Date(newToken.expiresAt).toLocaleString()}):
            </div>
            <CodeBlock>{newToken.token}</CodeBlock>

            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>Windows install</div>
            <CodeBlock>{`Download the latest agent.exe from https://github.com/bibek-n/logmonitor/releases\nand run as administrator:\n\nagent.exe install --token=${newToken.token} --server=${serverUrl}`}</CodeBlock>

            <div style={{ fontSize: "0.82rem", fontWeight: 600, marginTop: "0.5rem" }}>Linux install</div>
            <CodeBlock>{`curl -fsSL https://raw.githubusercontent.com/bibek-n/logmonitor/main/install.sh | sudo TOKEN=${newToken.token} SERVER_URL=${serverUrl} bash`}</CodeBlock>
          </div>
        )}
      </Card>

      <Card>
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.75rem" }}>Recent tokens</h2>
        {tokens.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No tokens generated yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Created</th>
                <th style={{ padding: "0.4rem" }}>Expires</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Used by device</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => {
                const expired = new Date(t.ExpiresAt).getTime() < Date.now();
                return (
                  <tr key={t.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{new Date(t.CreatedAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem" }}>{new Date(t.ExpiresAt).toLocaleString()}</td>
                    <td style={{ padding: "0.4rem" }}>
                      {t.UsedAt ? (
                        <Badge tone="success">Used</Badge>
                      ) : expired ? (
                        <Badge tone="danger">Expired</Badge>
                      ) : (
                        <Badge tone="info">Unused</Badge>
                      )}
                    </td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{t.UsedByDeviceId ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

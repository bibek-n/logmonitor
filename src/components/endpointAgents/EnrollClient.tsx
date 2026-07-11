"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { CopyButton } from "@/components/ui/CopyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface TokenRow {
  Id: number;
  Token: string;
  CreatedAt: string;
  ExpiresAt: string;
  UsedAt: string | null;
  UsedByDeviceId: string | null;
  StaffId: number | null;
  StaffName: string | null;
  PreCreatedDeviceId: string | null;
}

export interface StaffOption {
  id: number;
  name: string;
  currentIp: string | null;
  deviceName: string | null;
  macAddress: string | null;
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

function EnrollClientInner({ existingTokens, staffOptions }: { existingTokens: TokenRow[]; staffOptions: StaffOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [staffId, setStaffId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; expiresAt: string } | null>(null);
  const [tokens, setTokens] = useState(existingTokens);
  const [deleteTarget, setDeleteTarget] = useState<TokenRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedStaff = staffOptions.find((s) => String(s.id) === staffId) ?? null;

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/enrollment-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId: staffId ? Number(staffId) : null, preCreatedDeviceId: null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to generate token");
      setNewToken({ token: data.token, expiresAt: data.expiresAt });
      setTokens((prev) => [
        {
          Id: data.id,
          Token: data.token,
          CreatedAt: new Date().toISOString(),
          ExpiresAt: data.expiresAt,
          UsedAt: null,
          UsedByDeviceId: null,
          StaffId: data.staffId,
          StaffName: selectedStaff?.name ?? null,
          PreCreatedDeviceId: data.preCreatedDeviceId,
        },
        ...prev,
      ]);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to generate token" });
    } finally {
      setGenerating(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/enrollment-tokens/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete token");
      setTokens((prev) => prev.filter((t) => t.Id !== deleteTarget.Id));
      toast.show({ type: "success", message: "Token deleted." });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to delete token" });
    } finally {
      setDeleting(false);
    }
  }

  const serverUrl = typeof window !== "undefined" ? window.location.origin : "https://logs.tulipshrm.com:4433";

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <div style={{ maxWidth: 360 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" }}>
            Employee (optional)
          </label>
          <Select
            value={staffId}
            onChange={setStaffId}
            placeholder="-- Not assigned to an employee --"
            options={staffOptions.map((s) => ({ label: s.name, value: String(s.id) }))}
          />
          {selectedStaff && (
            <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
              {selectedStaff.deviceName ? `${selectedStaff.deviceName} · ` : ""}
              {selectedStaff.currentIp ?? "no known IP"} · {selectedStaff.macAddress ?? "no known device yet"}
            </p>
          )}
        </div>

        <Button onClick={generate} disabled={generating} style={{ alignSelf: "flex-start" }}>
          {generating ? "Generating..." : "Generate enrollment token"}
        </Button>

        {newToken && (
          <div className="flex flex-col gap-3">
            <div style={{ fontSize: "0.82rem", color: "var(--ink-secondary)" }}>
              Token (expires {new Date(newToken.expiresAt).toLocaleString()}):
            </div>
            <div className="flex items-center gap-2">
              <div style={{ flex: 1 }}>
                <CodeBlock>{newToken.token}</CodeBlock>
              </div>
              <CopyButton value={newToken.token} />
            </div>

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
                <th style={{ padding: "0.4rem" }}>Employee</th>
                <th style={{ padding: "0.4rem" }}>Used by device</th>
                <th style={{ padding: "0.4rem" }}></th>
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
                    <td style={{ padding: "0.4rem" }}>{t.StaffName ?? "-"}</td>
                    <td style={{ padding: "0.4rem", fontFamily: "monospace", fontSize: "0.75rem" }}>{t.UsedByDeviceId ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <button
                        onClick={() => setDeleteTarget(t)}
                        title="Delete"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete enrollment token"
        message="This permanently removes the token. If it hasn't been used yet, it can no longer be redeemed to enroll a device."
        confirmLabel="Delete"
        loading={deleting}
      />
    </div>
  );
}

export function EnrollClient(props: { existingTokens: TokenRow[]; staffOptions: StaffOption[] }) {
  return (
    <ToastProvider>
      <EnrollClientInner {...props} />
    </ToastProvider>
  );
}

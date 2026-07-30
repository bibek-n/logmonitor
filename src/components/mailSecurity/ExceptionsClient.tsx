"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const EXCEPTION_TYPES = [
  "TrustedSender",
  "TrustedRecipient",
  "ApprovedDomain",
  "ApprovedExtension",
  "ApprovedMimeType",
  "ApprovedHash",
  "ApprovedCloudDomain",
  "ApprovedUrl",
];

interface ExceptionRow {
  Id: number;
  PolicyId: number | null;
  PolicyName: string | null;
  ExceptionType: string;
  ExceptionValue: string;
  Reason: string;
  ApprovedByUsername: string | null;
  ExpiresAt: string | null;
  RevokedAt: string | null;
  CreatedAt: string;
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function ExceptionsInner() {
  const toast = useToast();
  const [rows, setRows] = useState<ExceptionRow[] | null>(null);
  const [exceptionType, setExceptionType] = useState(EXCEPTION_TYPES[0]);
  const [exceptionValue, setExceptionValue] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mail-security/exceptions");
    const data = await res.json();
    if (res.ok && data.ok) setRows(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!exceptionValue.trim() || !reason.trim()) {
      toast.show({ type: "error", message: "Value and reason are both required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/mail-security/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exceptionType,
          exceptionValue: exceptionValue.trim(),
          reason: reason.trim(),
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add exception.");
      toast.show({ type: "success", message: "Exception added." });
      setExceptionValue("");
      setReason("");
      setExpiresAt("");
      await load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add exception." });
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(id: number) {
    const res = await fetch(`/api/admin/mail-security/exceptions/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to revoke exception." });
      return;
    }
    await load();
  }

  return (
    <div>
      <Card style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Type</label>
            <select value={exceptionType} onChange={(e) => setExceptionType(e.target.value)} style={inputStyle}>
              {EXCEPTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Value</label>
            <input value={exceptionValue} onChange={(e) => setExceptionValue(e.target.value)} style={inputStyle} placeholder="e.g. partner.com or a SHA-256 hash" />
          </div>
        </div>
        <div className="field">
          <label>Reason (required, auditable)</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle} />
        </div>
        <div className="field">
          <label>Expires (optional)</label>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={{ ...inputStyle, maxWidth: 220 }} />
        </div>
        <Button onClick={add} disabled={submitting}>
          {submitting ? "Adding..." : "Add Exception"}
        </Button>
      </Card>

      {rows === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : (
        <div className="dash-panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Type</th>
                  <th style={{ padding: "0.4rem" }}>Value</th>
                  <th style={{ padding: "0.4rem" }}>Reason</th>
                  <th style={{ padding: "0.4rem" }}>Approved By</th>
                  <th style={{ padding: "0.4rem" }}>Expires</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const expired = r.ExpiresAt && new Date(r.ExpiresAt).getTime() <= Date.now();
                  const revoked = !!r.RevokedAt;
                  return (
                    <tr key={r.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>{r.ExceptionType}</td>
                      <td style={{ padding: "0.4rem", fontFamily: "monospace" }}>{r.ExceptionValue}</td>
                      <td style={{ padding: "0.4rem" }}>{r.Reason}</td>
                      <td style={{ padding: "0.4rem" }}>{r.ApprovedByUsername ?? "-"}</td>
                      <td style={{ padding: "0.4rem" }}>{r.ExpiresAt ? new Date(r.ExpiresAt).toLocaleDateString() : "-"}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: revoked ? "var(--danger)" : expired ? "var(--warning)" : "var(--success)" }}>
                          {revoked ? "Revoked" : expired ? "Expired" : "Active"}
                        </span>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        {!revoked && (
                          <button
                            onClick={() => revoke(r.Id)}
                            style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", fontSize: "0.8rem" }}
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function ExceptionsClient() {
  return (
    <ToastProvider>
      <ExceptionsInner />
    </ToastProvider>
  );
}

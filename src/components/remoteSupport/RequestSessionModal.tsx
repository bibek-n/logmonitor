"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { RemoteSupportDevice } from "./RemoteSupportConsole";

export function RequestSessionModal({
  device,
  onClose,
  onRequested,
  onError,
}: {
  device: RemoteSupportDevice;
  onClose: () => void;
  onRequested: (sessionId: number) => void;
  onError: (message: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [control, setControl] = useState(false);
  const [fileTransfer, setFileTransfer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!reason.trim()) {
      onError("A reason is required so the employee knows what they're approving.");
      return;
    }
    setSubmitting(true);
    try {
      const permissions = [control && "control", fileTransfer && "file_transfer"].filter(Boolean);
      const res = await fetch("/api/admin/remote-support/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.deviceId, reason: reason.trim(), permissions }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        onError(data.error ?? "Failed to send the session request.");
        return;
      }
      onRequested(data.sessionId);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Request support session — ${device.hostname}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Sending..." : "Send Request"}
          </Button>
        </>
      }
    >
      <label style={{ display: "block", fontSize: "0.82rem", color: "var(--ink-secondary)", marginBottom: 6 }}>
        Reason (shown to the employee)
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="e.g. Troubleshooting the printer driver issue you reported"
        style={{
          width: "100%",
          padding: "0.6rem 0.8rem",
          borderRadius: 10,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontSize: "0.85rem",
          resize: "vertical",
          marginBottom: "1rem",
        }}
      />

      <div style={{ fontSize: "0.82rem", color: "var(--ink-secondary)", marginBottom: 8 }}>Permissions to request</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: "0.5rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--ink)" }}>
          <input type="checkbox" checked disabled />
          View screen (always included)
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--ink)", cursor: "pointer" }}>
          <input type="checkbox" checked={control} onChange={(e) => setControl(e.target.checked)} />
          Control mouse and keyboard
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.85rem", color: "var(--ink)", cursor: "pointer" }}>
          <input type="checkbox" checked={fileTransfer} onChange={(e) => setFileTransfer(e.target.checked)} />
          File transfer
        </label>
      </div>
      <p style={{ fontSize: "0.76rem", color: "var(--ink-muted)", margin: 0 }}>
        The employee sees exactly what you&apos;re requesting and must explicitly approve before anything starts.
      </p>
    </Modal>
  );
}

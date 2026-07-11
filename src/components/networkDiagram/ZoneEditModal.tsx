"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { DiagramZone } from "@/lib/networkDiagram";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.83rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.25rem" };

export function ZoneEditModal({
  zone,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  zone: DiagramZone;
  isNew: boolean;
  onSave: (zone: DiagramZone) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(zone.label);

  function save() {
    if (!label.trim()) return;
    onSave({ ...zone, label: label.trim() });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add Zone" : "Edit Zone"}
      footer={
        <>
          {!isNew && onDelete && (
            <Button variant="danger" size="sm" onClick={onDelete} style={{ marginRight: "auto" }}>
              Delete
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div>
          <label style={labelStyle}>Zone Label</label>
          <input style={fieldStyle} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Branch LAN — 192.168.20.0/24" />
        </div>
        <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: 0 }}>Drag the zone to move it, or use its corner handles to resize.</p>
      </div>
    </Modal>
  );
}

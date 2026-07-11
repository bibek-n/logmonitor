"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ICON_LABELS, type DiagramNode, type IconKey } from "@/lib/networkDiagram";

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

const ICON_OPTIONS = (Object.keys(ICON_LABELS) as IconKey[]).map((k) => ({ label: ICON_LABELS[k], value: k }));

export function NodeEditModal({
  node,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  node: DiagramNode;
  isNew: boolean;
  onSave: (node: DiagramNode) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    iconKey: node.iconKey,
    title: node.title,
    subtitle: node.subtitle ?? "",
    highlighted: node.tone === "firewall",
  });

  function save() {
    if (!form.title.trim()) return;
    onSave({
      ...node,
      iconKey: form.iconKey,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || undefined,
      tone: form.highlighted ? "firewall" : "default",
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Add Node" : "Edit Node"}
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
          <label style={labelStyle}>Icon / Type</label>
          <Select value={form.iconKey} onChange={(v) => setForm((f) => ({ ...f, iconKey: v as IconKey }))} options={ICON_OPTIONS} />
        </div>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={fieldStyle} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Main Switch" />
        </div>
        <div>
          <label style={labelStyle}>Subtitle (optional)</label>
          <input
            style={fieldStyle}
            value={form.subtitle}
            onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
            placeholder="e.g. an IP address or port"
          />
        </div>
        <label className="flex items-center gap-2" style={{ fontSize: "0.8rem", color: "var(--ink-secondary)" }}>
          <input type="checkbox" checked={form.highlighted} onChange={(e) => setForm((f) => ({ ...f, highlighted: e.target.checked }))} />
          Highlight border (e.g. for a firewall)
        </label>
      </div>
    </Modal>
  );
}

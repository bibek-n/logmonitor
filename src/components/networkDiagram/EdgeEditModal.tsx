"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import type { DiagramEdge } from "@/lib/networkDiagram";

export function EdgeEditModal({
  edge,
  onSave,
  onDelete,
  onClose,
}: {
  edge: DiagramEdge;
  onSave: (edge: DiagramEdge) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [dashed, setDashed] = useState(edge.dashed);

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit Connection"
      footer={
        <>
          <Button variant="danger" size="sm" onClick={onDelete} style={{ marginRight: "auto" }}>
            Delete
          </Button>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave({ ...edge, dashed })}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Switch checked={dashed} onChange={setDashed} label={dashed ? "Dashed (logical connection)" : "Solid (physical connection)"} />
      </div>
    </Modal>
  );
}

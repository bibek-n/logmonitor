"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { EditServerModal, type EditableServer } from "./EditServerModal";

function ServerDetailActionsInner({ server }: { server: EditableServer }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/servers/${server.DeviceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete server");
      toast.show({ type: "success", message: "Server deleted." });
      router.push("/dashboard/servers");
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit
        </Button>
        <Button size="sm" variant="danger" onClick={() => setDeleting(true)}>
          <Trash2 size={13} /> Delete
        </Button>
      </div>

      {editing && <EditServerModal server={server} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={confirmDelete}
        title={`Delete ${server.DeviceName ?? "this server"}?`}
        message="This permanently removes the server record and all its collected hardware/metrics/log history. This cannot be undone. If the agent is still installed on the machine, it will keep running but its data will no longer appear here unless re-enrolled."
        confirmLabel="Delete Server"
        tone="danger"
        loading={deleteLoading}
      />
    </>
  );
}

export function ServerDetailActions({ server }: { server: EditableServer }) {
  return (
    <ToastProvider>
      <ServerDetailActionsInner server={server} />
    </ToastProvider>
  );
}

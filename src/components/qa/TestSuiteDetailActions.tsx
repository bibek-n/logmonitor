"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Archive } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { EditSuiteModal, type TestSuiteRow, type QaModuleOption } from "@/components/qa/TestSuitesClient";

function Inner({
  suite, modules, canEdit, canDelete,
}: {
  suite: TestSuiteRow;
  modules: QaModuleOption[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirmArchive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/qa/test-suites/${suite.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to archive.");
      toast.show({ type: "success", message: "Test suite archived." });
      setArchiving(false);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setLoading(false);
    }
  }

  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center gap-2">
      {canEdit && (
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          <Pencil size={13} /> Edit
        </Button>
      )}
      {canDelete && suite.Status !== "Archived" && (
        <Button size="sm" variant="danger" onClick={() => setArchiving(true)}>
          <Archive size={13} /> Archive
        </Button>
      )}

      {editing && (
        <EditSuiteModal
          suite={suite}
          modules={modules}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        onConfirm={confirmArchive}
        title={`Archive "${suite.Name}"?`}
        message="Archived suites are hidden from the default list but not deleted."
        confirmLabel="Archive Suite"
        tone="danger"
        loading={loading}
      />
    </div>
  );
}

export function TestSuiteDetailActions(props: { suite: TestSuiteRow; modules: QaModuleOption[]; canEdit: boolean; canDelete: boolean }) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}

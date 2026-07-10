"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { EditServerModal, type EditableServer } from "./EditServerModal";

interface ServerRow extends EditableServer {
  Hostname: string;
  LastIp: string | null;
  OS: string;
  LastHeartbeat: string | null;
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Active: "success",
  Pending: "neutral",
  Maintenance: "warning",
  Decommissioned: "danger",
};

function isOnline(lastHeartbeat: string | null): boolean {
  if (!lastHeartbeat) return false;
  return Date.now() - new Date(lastHeartbeat).getTime() < 5 * 60 * 1000;
}

function ServersTableInner({ servers }: { servers: ServerRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<ServerRow | null>(null);
  const [deleting, setDeleting] = useState<ServerRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/servers/${deleting.DeviceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete server");
      toast.show({ type: "success", message: `${deleting.DeviceName ?? deleting.Hostname} deleted.` });
      setDeleting(null);
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <Card style={{ padding: 0 }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                {["Device Name", "Hostname", "IP Address", "Role", "OS", "MAC Address", "Status", "Connectivity", ""].map((h) => (
                  <th key={h} style={{ padding: "0.6rem 0.9rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.DeviceId} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Link href={`/dashboard/servers/${s.DeviceId}`} style={{ color: "var(--primary)" }}>
                      {s.DeviceName || s.Hostname || "(unnamed)"}
                    </Link>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", color: s.Hostname ? undefined : "var(--ink-muted)" }}>
                    {s.Hostname || "Pending enrollment"}
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{s.StaticIpAddress ?? s.LastIp ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>{s.ServerRole ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem", textTransform: "capitalize" }}>{s.OS}</td>
                  <td style={{ padding: "0.6rem 0.9rem", fontFamily: "monospace", fontSize: "0.78rem" }}>{s.MacAddress ?? "—"}</td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={STATUS_TONE[s.LifecycleStatus] ?? "neutral"}>{s.LifecycleStatus}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem" }}>
                    <Badge tone={isOnline(s.LastHeartbeat) ? "success" : "neutral"}>{isOnline(s.LastHeartbeat) ? "Online" : "Offline"}</Badge>
                  </td>
                  <td style={{ padding: "0.6rem 0.9rem", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(s)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", marginRight: 10 }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(s)} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: "1.5rem", textAlign: "center", color: "var(--ink-muted)" }}>
                    No servers registered yet — click "Add Server" to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && <EditServerModal server={editing} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleting?.DeviceName ?? deleting?.Hostname ?? "this server"}?`}
        message="This permanently removes the server record and all its collected hardware/metrics/log history. This cannot be undone. If the agent is still installed on the machine, it will keep running but its data will no longer appear here unless re-enrolled."
        confirmLabel="Delete Server"
        tone="danger"
        loading={deleteLoading}
      />
    </>
  );
}

export function ServersTable({ servers }: { servers: ServerRow[] }) {
  return (
    <ToastProvider>
      <ServersTableInner servers={servers} />
    </ToastProvider>
  );
}

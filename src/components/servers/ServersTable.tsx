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

  if (servers.length === 0) {
    return (
      <Card style={{ textAlign: "center", color: "var(--ink-muted)", padding: "1.75rem 1rem" }}>
        No servers registered yet — click &quot;Add Server&quot; to get started.
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {servers.map((s) => (
          <Card key={s.DeviceId} className="flex flex-col gap-2" style={{ padding: "0.9rem 1rem" }}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/dashboard/servers/${s.DeviceId}`} style={{ color: "var(--primary)", fontWeight: 600, fontSize: "0.95rem" }}>
                {s.DeviceName || s.Hostname || "(unnamed)"}
              </Link>
              <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                <Badge tone={isOnline(s.LastHeartbeat) ? "success" : "neutral"}>{isOnline(s.LastHeartbeat) ? "Online" : "Offline"}</Badge>
                <Badge tone={STATUS_TONE[s.LifecycleStatus] ?? "neutral"}>{s.LifecycleStatus}</Badge>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink-muted)" }}>
              {s.Hostname || "Pending enrollment"} · {s.ServerRole ?? "No role set"}
            </p>
            <dl className="grid grid-cols-2 gap-2" style={{ margin: 0, fontSize: "0.78rem" }}>
              <div>
                <dt style={{ color: "var(--ink-muted)" }}>IP Address</dt>
                <dd style={{ margin: 0 }}>{s.StaticIpAddress ?? s.LastIp ?? "—"}</dd>
              </div>
              <div>
                <dt style={{ color: "var(--ink-muted)" }}>OS</dt>
                <dd style={{ margin: 0, textTransform: "capitalize" }}>{s.OS}</dd>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <dt style={{ color: "var(--ink-muted)" }}>MAC Address</dt>
                <dd style={{ margin: 0, fontFamily: "monospace" }}>{s.MacAddress ?? "—"}</dd>
              </div>
            </dl>
            <div className="flex items-center gap-3" style={{ marginTop: "0.15rem" }}>
              <button
                onClick={() => setEditing(s)}
                className="flex items-center gap-1"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)", fontSize: "0.8rem", padding: 0 }}
              >
                <Pencil size={13} /> Edit
              </button>
              <button
                onClick={() => setDeleting(s)}
                className="flex items-center gap-1"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.8rem", padding: 0 }}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden md:block" style={{ padding: 0 }}>
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

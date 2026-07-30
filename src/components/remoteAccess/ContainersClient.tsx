"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: string;
}
interface KubernetesPod {
  name: string;
  ready: string;
  status: string;
  restarts: string;
  age: string;
}

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" };

function ContainersInner({ connectionId }: { connectionId: number }) {
  const toast = useToast();
  const router = useRouter();
  const [type, setType] = useState<"docker" | "kubernetes">("docker");
  const [namespace, setNamespace] = useState("default");
  const [containers, setContainers] = useState<DockerContainer[] | null>(null);
  const [pods, setPods] = useState<KubernetesPod[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setContainers(null);
    setPods(null);
    const res = await fetch(`/api/admin/remote-access/connections/${connectionId}/containers?type=${type}&namespace=${encodeURIComponent(namespace)}`);
    const data = await res.json();
    setLoading(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to list containers." });
      return;
    }
    if (type === "docker") setContainers(data.data.containers);
    else setPods(data.data.pods);
  }, [connectionId, type, namespace, toast]);

  async function openShell(target: { containerId?: string; podName?: string }) {
    const key = target.containerId ?? target.podName ?? "";
    setOpening(key);
    const body = type === "docker" ? { type: "docker", containerId: target.containerId } : { type: "kubernetes", namespace, podName: target.podName };
    const res = await fetch(`/api/admin/remote-access/connections/${connectionId}/containers/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setOpening(null);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to open shell." });
      return;
    }
    router.push(`/dashboard/remote-access/terminal/${data.data.sessionId}`);
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.78rem" }}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as "docker" | "kubernetes")} style={inputStyle}>
              <option value="docker">Docker</option>
              <option value="kubernetes">Kubernetes</option>
            </select>
          </div>
          {type === "kubernetes" && (
            <div>
              <label style={{ display: "block", fontSize: "0.78rem" }}>Namespace</label>
              <input value={namespace} onChange={(e) => setNamespace(e.target.value)} style={inputStyle} />
            </div>
          )}
          <Button onClick={load} disabled={loading}>
            {loading ? "Loading..." : "List"}
          </Button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.6rem", marginBottom: 0 }}>
          Runs <code>{type === "docker" ? "docker ps" : "kubectl get pods"}</code> over this connection&apos;s existing SSH session - the target host
          needs {type === "docker" ? "Docker" : "kubectl"} installed and accessible to the connection&apos;s user.
        </p>
      </Card>

      <div className="dash-panel">
        {type === "docker" ? (
          containers === null ? (
            <p style={{ color: "var(--ink-muted)" }}>Click List to see containers on this host.</p>
          ) : containers.length === 0 ? (
            <p style={{ color: "var(--ink-muted)" }}>No containers found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Image</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {containers.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{c.name}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{c.image}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Badge tone={c.status.toLowerCase().startsWith("up") ? "success" : "neutral"}>{c.status}</Badge>
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <Button size="sm" onClick={() => openShell({ containerId: c.id })} disabled={opening === c.id}>
                        {opening === c.id ? "Opening..." : "Shell"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : pods === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Click List to see pods in this namespace.</p>
        ) : pods.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No pods found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Name</th>
                <th style={{ padding: "0.4rem" }}>Ready</th>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Restarts</th>
                <th style={{ padding: "0.4rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {pods.map((p) => (
                <tr key={p.name} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{p.name}</td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{p.ready}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={p.status === "Running" ? "success" : "neutral"}>{p.status}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{p.restarts}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Button size="sm" onClick={() => openShell({ podName: p.name })} disabled={opening === p.name}>
                      {opening === p.name ? "Opening..." : "Shell"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function ContainersClient({ connectionId }: { connectionId: number }) {
  return (
    <ToastProvider>
      <ContainersInner connectionId={connectionId} />
    </ToastProvider>
  );
}

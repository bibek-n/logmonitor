"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" };

interface RolloutData {
  EmployeeTargetVersion: string | null;
  ServerTargetVersion: string | null;
  UpdatedAt: string | null;
}

interface VersionBucket {
  DeviceType: string;
  AgentVersion: string | null;
  Cnt: number;
}

function RolloutInner() {
  const toast = useToast();
  const [employeeTargetVersion, setEmployeeTargetVersion] = useState("");
  const [serverTargetVersion, setServerTargetVersion] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/endpoint-agents/rollout");
    const data = await res.json();
    if (res.ok && data.ok) {
      const settings: RolloutData = data.data;
      setEmployeeTargetVersion(settings.EmployeeTargetVersion ?? "");
      setServerTargetVersion(settings.ServerTargetVersion ?? "");
      setUpdatedAt(settings.UpdatedAt);
      setVersions(data.versions ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/endpoint-agents/rollout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeTargetVersion, serverTargetVersion }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.show({ type: "success", message: "Rollout targets saved - devices will update on their next heartbeat/update check." });
        await load();
      } else {
        toast.show({ type: "error", message: data.error ?? "Failed to save" });
      }
    } finally {
      setSaving(false);
    }
  }

  const employeeVersions = versions.filter((v) => v.DeviceType !== "Server");
  const serverVersions = versions.filter((v) => v.DeviceType === "Server");

  function VersionTable({ rows, targetVersion }: { rows: VersionBucket[]; targetVersion: string }) {
    if (rows.length === 0) return <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>No devices of this type yet.</p>;
    return (
      <table style={{ width: "100%", fontSize: "0.82rem", borderCollapse: "collapse" }}>
        <tbody>
          {rows.map((r) => (
            <tr key={r.AgentVersion ?? "unknown"} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.3rem 0" }}>
                {r.AgentVersion ?? "(unknown)"}
                {targetVersion && r.AgentVersion === targetVersion && (
                  <span style={{ color: "var(--success)", marginLeft: "0.4rem", fontSize: "0.72rem" }}>&#10003; target</span>
                )}
              </td>
              <td style={{ padding: "0.3rem 0", textAlign: "right", color: "var(--ink-muted)" }}>{r.Cnt} device{r.Cnt === 1 ? "" : "s"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (loading) return <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 720 }}>
      <Card>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Approve a rollout</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0, marginBottom: "1rem" }}>
          A release tag like <code>agent-v0.18.1</code> - devices pick it up automatically (checksum-verified, with
          automatic rollback if the new version fails to heartbeat within 3 minutes - see agent/update.go). Clear a field
          to hold that device type at its current version. Devices don&apos;t need to be rebooted or manually touched -
          this takes effect on the agent&apos;s own next heartbeat/update check (within the hour, sooner if the service
          happens to restart).
        </p>
        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Workstations (employee PCs)</label>
            <input
              value={employeeTargetVersion}
              onChange={(e) => setEmployeeTargetVersion(e.target.value)}
              placeholder="agent-v0.18.1"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Servers</label>
            <input
              value={serverTargetVersion}
              onChange={(e) => setServerTargetVersion(e.target.value)}
              placeholder="agent-v0.18.1"
              style={inputStyle}
            />
          </div>
        </div>
        <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save rollout targets"}
          </Button>
          {updatedAt && (
            <span style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>
              Last changed {new Date(updatedAt).toLocaleString()}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Current adoption</h3>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: 0, marginBottom: "0.75rem" }}>
          What&apos;s actually running right now, by device type.
        </p>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem" }}>Workstations</div>
            <VersionTable rows={employeeVersions} targetVersion={employeeTargetVersion} />
          </div>
          <div>
            <div style={{ fontSize: "0.8rem", fontWeight: 600, marginBottom: "0.4rem" }}>Servers</div>
            <VersionTable rows={serverVersions} targetVersion={serverTargetVersion} />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function AgentRolloutClient() {
  return (
    <ToastProvider>
      <RolloutInner />
    </ToastProvider>
  );
}

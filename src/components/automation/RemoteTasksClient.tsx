"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DeviceMultiSelect } from "./DeviceMultiSelect";

interface ScriptOption {
  id: number;
  name: string;
  powerShellBody: string | null;
  bashBody: string | null;
}

interface DeviceOption {
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  deviceType: string;
  os: string;
}

interface JobTarget {
  id: number;
  deviceId: string;
  deviceName: string | null;
  hostname: string;
  os: string;
  status: string;
}

interface JobRow {
  id: number;
  scriptNameSnapshot: string;
  triggerType: string;
  createdAt: string;
  targets: JobTarget[];
}

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function summarizeTargets(targets: JobTarget[]): { label: string; color: string } {
  if (targets.some((t) => t.status === "Pending" || t.status === "Running")) return { label: "In Progress", color: "var(--warning, #b8860b)" };
  if (targets.some((t) => t.status === "Failed" || t.status === "TimedOut" || t.status === "Error")) return { label: "Failed", color: "var(--danger)" };
  return { label: "Success", color: "var(--success)" };
}

function RemoteTasksInner() {
  const toast = useToast();
  const [scripts, setScripts] = useState<ScriptOption[] | null>(null);
  const [devices, setDevices] = useState<DeviceOption[] | null>(null);
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [scriptId, setScriptId] = useState<number | null>(null);
  const [deviceIds, setDeviceIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/admin/automation/jobs");
    const data = await res.json();
    if (res.ok && data.ok) setJobs(data.data);
  }, []);

  useEffect(() => {
    (async () => {
      const [scriptsRes, devicesRes] = await Promise.all([fetch("/api/admin/automation/scripts"), fetch("/api/admin/automation/devices")]);
      const scriptsData = await scriptsRes.json();
      const devicesData = await devicesRes.json();
      if (scriptsRes.ok && scriptsData.ok) setScripts(scriptsData.data);
      if (devicesRes.ok && devicesData.ok) setDevices(devicesData.data);
    })();
    loadJobs();
  }, [loadJobs]);

  const selectedScript = scripts?.find((s) => s.id === scriptId) ?? null;

  async function runNow() {
    if (!scriptId) {
      toast.show({ type: "error", message: "Choose a script to run." });
      return;
    }
    if (deviceIds.length === 0) {
      toast.show({ type: "error", message: "Select at least one target device." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/automation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptId, deviceIds }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to queue the task.");
      toast.show({ type: "success", message: `Task queued for ${deviceIds.length} device(s) - picked up on each agent's next check-in (~30s).` });
      setDeviceIds([]);
      await loadJobs();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to queue the task." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Run a Script Now</h3>
        <div style={{ marginBottom: "0.6rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Script</label>
          <select
            value={scriptId ?? ""}
            onChange={(e) => setScriptId(e.target.value ? Number(e.target.value) : null)}
            style={{ ...inputStyle, minWidth: 260 }}
          >
            <option value="">Choose a script...</option>
            {scripts?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedScript && (
            <span style={{ marginLeft: "0.6rem", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              Runs on: {[selectedScript.powerShellBody ? "Windows" : null, selectedScript.bashBody ? "Linux" : null].filter(Boolean).join(" + ")}
            </span>
          )}
        </div>

        <div style={{ marginBottom: "0.8rem" }}>
          <DeviceMultiSelect devices={devices ?? []} selected={deviceIds} onChange={setDeviceIds} />
        </div>

        <Button onClick={runNow} disabled={submitting}>
          Run Now
        </Button>
        <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: "0.5rem", marginBottom: 0 }}>
          Every selected device runs this script with full SYSTEM/root privilege as soon as its agent next checks in (about 30 seconds).
        </p>
      </Card>

      <div className="dash-panel">
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Recent Runs</h3>
        {jobs === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : jobs.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No tasks have been run yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Script</th>
                  <th style={{ padding: "0.4rem" }}>Trigger</th>
                  <th style={{ padding: "0.4rem" }}>Targets</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Queued</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const summary = summarizeTargets(j.targets);
                  return (
                    <tr key={j.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>{j.scriptNameSnapshot}</td>
                      <td style={{ padding: "0.4rem" }}>{j.triggerType}</td>
                      <td style={{ padding: "0.4rem" }}>{j.targets.length}</td>
                      <td style={{ padding: "0.4rem", color: summary.color, fontWeight: 600 }}>{summary.label}</td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{new Date(j.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/automation/tasks/${j.id}`} style={{ color: "var(--accent)", fontSize: "0.82rem" }}>
                          View Output
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export function RemoteTasksClient() {
  return (
    <ToastProvider>
      <RemoteTasksInner />
    </ToastProvider>
  );
}

"use client";

import { Fragment, useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

const DEFAULT_EXTENSIONS = ["exe", "msi", "bat", "cmd", "com", "scr", "dll", "ps1", "vbs", "js", "jar", "apk", "iso", "img"];
const CHARACTERISTIC_KEYS = [
  { key: "passwordProtected", label: "Password-protected" },
  { key: "corrupted", label: "Corrupted" },
  { key: "doubleExtension", label: "Double extension" },
  { key: "hiddenExtension", label: "Hidden extension" },
  { key: "noExtension", label: "No extension" },
  { key: "embeddedFiles", label: "Embedded files" },
  { key: "macroEnabled", label: "Macro-enabled" },
  { key: "executableContent", label: "Executable content" },
] as const;

interface PolicyRow {
  Id: number;
  Name: string;
  Description: string | null;
  Enabled: boolean;
  Mandatory: boolean;
  Direction: string;
  Priority: number;
  Action: string;
  MatchCount: number;
  LastTriggeredAt: string | null;
}

const inputStyle = {
  width: "100%",
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const chipStyle = (active: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.25rem 0.6rem",
  borderRadius: 999,
  border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
  background: active ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "transparent",
  fontSize: "0.78rem",
  cursor: "pointer",
});

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={chipStyle(active)}>
      {label}
    </button>
  );
}

function NewPolicyForm({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState("Both");
  const [action, setAction] = useState("Block");
  const [priority, setPriority] = useState(100);
  const [mandatory, setMandatory] = useState(false);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [customExtension, setCustomExtension] = useState("");
  const [characteristics, setCharacteristics] = useState<Record<string, boolean>>({});
  const [scopeType, setScopeType] = useState<"Global" | "Domain">("Global");
  const [scopeValue, setScopeValue] = useState("");
  const [blockAllCloudLinks, setBlockAllCloudLinks] = useState(false);

  function toggleExtension(ext: string) {
    setExtensions((prev) => (prev.includes(ext) ? prev.filter((e) => e !== ext) : [...prev, ext]));
  }

  async function submit() {
    if (!name.trim()) {
      toast.show({ type: "error", message: "Policy name is required." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/mail-security/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          direction,
          action,
          priority,
          mandatory,
          enabled: true,
          rules: { extensions, mimeTypes: [], characteristics, archiveLimits: {} },
          urlRules: { blockAllCloudLinks, blockedProviders: [], blockPublicSharing: false, blockDownloadable: false, urlPatterns: [], allowlist: [] },
          scopes: [{ scopeType, scopeValue: scopeType === "Global" ? null : scopeValue.trim() }],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create policy.");
      toast.show({ type: "success", message: "Policy created." });
      setOpen(false);
      setName("");
      setDescription("");
      setExtensions([]);
      setCharacteristics({});
      onCreated();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to create policy." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} style={{ marginBottom: "1rem" }}>
        New Policy
      </Button>
    );
  }

  return (
    <Card style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="e.g. Block executables in Finance dept" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Priority (lower = evaluated first)</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <div className="field">
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "0.75rem", alignItems: "end", marginBottom: "1rem" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Direction</label>
          <select value={direction} onChange={(e) => setDirection(e.target.value)} style={inputStyle}>
            <option value="Both">Both</option>
            <option value="Incoming">Incoming</option>
            <option value="Outgoing">Outgoing</option>
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Action</label>
          <select value={action} onChange={(e) => setAction(e.target.value)} style={inputStyle}>
            {["Reject", "Block", "Quarantine", "RemoveAttachment", "Warn", "Allow"].map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Scope</label>
          <select value={scopeType} onChange={(e) => setScopeType(e.target.value as "Global" | "Domain")} style={inputStyle}>
            <option value="Global">Global (everyone)</option>
            <option value="Domain">Domain</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", paddingBottom: "0.55rem" }}>
          <input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} />
          Mandatory (cannot be overridden by an exception)
        </label>
      </div>

      {scopeType === "Domain" && (
        <div className="field">
          <label>Domain (e.g. finance.company.com)</label>
          <input value={scopeValue} onChange={(e) => setScopeValue(e.target.value)} style={inputStyle} />
        </div>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem" }}>Blocked extensions</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {DEFAULT_EXTENSIONS.map((ext) => (
            <ChipToggle key={ext} label={`.${ext}`} active={extensions.includes(ext)} onClick={() => toggleExtension(ext)} />
          ))}
          {extensions.filter((e) => !DEFAULT_EXTENSIONS.includes(e)).map((ext) => (
            <ChipToggle key={ext} label={`.${ext}`} active onClick={() => toggleExtension(ext)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
          <input
            value={customExtension}
            onChange={(e) => setCustomExtension(e.target.value)}
            placeholder="custom extension, e.g. dat"
            style={{ ...inputStyle, maxWidth: 220 }}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const ext = customExtension.trim().replace(/^\./, "").toLowerCase();
              if (ext) toggleExtension(ext);
              setCustomExtension("");
            }}
          >
            Add
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem" }}>Characteristics</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {CHARACTERISTIC_KEYS.map((c) => (
            <ChipToggle
              key={c.key}
              label={c.label}
              active={!!characteristics[c.key]}
              onClick={() => setCharacteristics((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
            />
          ))}
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", marginBottom: "1rem" }}>
        <input type="checkbox" checked={blockAllCloudLinks} onChange={(e) => setBlockAllCloudLinks(e.target.checked)} />
        Block all cloud file-sharing links (Google Drive, OneDrive, SharePoint, Dropbox, Box, iCloud Drive, WeTransfer)
      </label>

      <div style={{ display: "flex", gap: "0.6rem" }}>
        <Button onClick={submit} disabled={submitting}>
          {submitting ? "Creating..." : "Create Policy"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function TestPanel({ policyId, onClose }: { policyId: number; onClose: () => void }) {
  const toast = useToast();
  const [sender, setSender] = useState("someone@example.com");
  const [recipients, setRecipients] = useState("staff@tulipshrm.com");
  const [subject, setSubject] = useState("Test message");
  const [direction, setDirection] = useState("Incoming");
  const [urls, setUrls] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      let attachments: { fileName: string; contentBase64: string }[] = [];
      if (file) {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(Array.from(new Uint8Array(buffer), (b) => String.fromCharCode(b)).join(""));
        attachments = [{ fileName: file.name, contentBase64: base64 }];
      }

      const res = await fetch(`/api/admin/mail-security/policies/${policyId}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            direction,
            sender,
            recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
            subject,
          },
          attachments,
          urls: urls.split("\n").map((u) => u.trim()).filter(Boolean),
          sendTestNotifications: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Test failed.");
      setResult(data.data);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Test failed." });
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card style={{ marginTop: "0.6rem", background: "var(--surface-2)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <strong style={{ fontSize: "0.85rem" }}>Test this policy (simulated message - nothing real is touched)</strong>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-muted)" }}>
          Close
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Sender" style={inputStyle} />
        <input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="Recipients (comma-separated)" style={inputStyle} />
        <select value={direction} onChange={(e) => setDirection(e.target.value)} style={inputStyle}>
          <option value="Incoming">Incoming</option>
          <option value="Outgoing">Outgoing</option>
        </select>
      </div>
      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" style={{ ...inputStyle, marginBottom: "0.5rem" }} />
      <div style={{ marginBottom: "0.5rem" }}>
        <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Attach a file (inspected for real - extension, MIME, magic bytes, archive contents)</label>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: "block", marginTop: "0.3rem", fontSize: "0.8rem" }} />
      </div>
      <textarea
        value={urls}
        onChange={(e) => setUrls(e.target.value)}
        placeholder="URLs to test, one per line"
        rows={3}
        style={{ ...inputStyle, marginBottom: "0.5rem", fontFamily: "monospace" }}
      />
      <Button onClick={run} disabled={running} size="sm">
        {running ? "Running..." : "Run Test"}
      </Button>

      {result && (
        <div style={{ marginTop: "0.75rem", padding: "0.6rem", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.3rem" }}>
            Decision: <span style={{ color: "var(--primary)" }}>{String((result.decision as { action?: string })?.action)}</span>
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{String((result.decision as { reason?: string })?.reason)}</div>
          <pre style={{ fontSize: "0.72rem", marginTop: "0.5rem", maxHeight: 220, overflow: "auto", background: "var(--surface-2)", padding: "0.5rem", borderRadius: 6 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

function PoliciesInner() {
  const toast = useToast();
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mail-security/policies");
    const data = await res.json();
    if (res.ok && data.ok) setPolicies(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled(policy: PolicyRow) {
    const res = await fetch(`/api/admin/mail-security/policies/${policy.Id}/${policy.Enabled ? "disable" : "enable"}`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to update policy." });
      return;
    }
    await load();
  }

  async function duplicate(policy: PolicyRow) {
    const res = await fetch(`/api/admin/mail-security/policies/${policy.Id}/duplicate`, { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to duplicate policy." });
      return;
    }
    toast.show({ type: "success", message: data.note ?? "Duplicated." });
    await load();
  }

  async function remove(policy: PolicyRow) {
    const res = await fetch(`/api/admin/mail-security/policies/${policy.Id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete policy." });
      return;
    }
    await load();
  }

  return (
    <div>
      <NewPolicyForm onCreated={load} />

      {policies === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : (
        <div className="dash-panel">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Direction</th>
                  <th style={{ padding: "0.4rem" }}>Action</th>
                  <th style={{ padding: "0.4rem" }}>Priority</th>
                  <th style={{ padding: "0.4rem" }}>Status</th>
                  <th style={{ padding: "0.4rem" }}>Matches</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <Fragment key={p.Id}>
                    <tr style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>
                        {p.Name}
                        {p.Mandatory && (
                          <span style={{ marginLeft: "0.4rem", fontSize: "0.7rem", padding: "0.1rem 0.4rem", borderRadius: 999, background: "var(--danger)", color: "#fff" }}>
                            Mandatory
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "0.4rem" }}>{p.Direction}</td>
                      <td style={{ padding: "0.4rem" }}>{p.Action}</td>
                      <td style={{ padding: "0.4rem" }}>{p.Priority}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <span style={{ color: p.Enabled ? "var(--success)" : "var(--ink-muted)" }}>{p.Enabled ? "Enabled" : "Disabled"}</span>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{p.MatchCount}</td>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "0.4rem" }}>
                          <Button size="sm" variant="secondary" onClick={() => setTestingId(testingId === p.Id ? null : p.Id)}>
                            Test
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => toggleEnabled(p)}>
                            {p.Enabled ? "Disable" : "Enable"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => duplicate(p)}>
                            Duplicate
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => remove(p)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {testingId === p.Id && (
                      <tr>
                        <td colSpan={7} style={{ padding: "0 0.4rem 0.6rem" }}>
                          <TestPanel policyId={p.Id} onClose={() => setTestingId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function PoliciesClient() {
  return (
    <ToastProvider>
      <PoliciesInner />
    </ToastProvider>
  );
}

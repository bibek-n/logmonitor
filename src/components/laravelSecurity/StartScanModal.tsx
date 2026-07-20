"use client";

import { useEffect, useState, FormEvent } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

interface RuleRow {
  Id: number;
  RuleCode: string;
  RuleName: string;
  Category: string;
  Enabled: boolean;
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };

export function StartScanModal({
  projectId,
  projectName,
  defaultBranch,
  open,
  onClose,
  onStarted,
}: {
  projectId: number;
  projectName: string;
  defaultBranch?: string | null;
  open: boolean;
  onClose: () => void;
  onStarted?: (scanId: number) => void;
}) {
  const toast = useToast();
  const [branch, setBranch] = useState(defaultBranch ?? "");
  const [scanType, setScanType] = useState<"Full" | "Incremental">("Full");
  const [includedDirectories, setIncludedDirectories] = useState("");
  const [excludedDirectories, setExcludedDirectories] = useState("");
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [enabledRuleCodes, setEnabledRuleCodes] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBranch(defaultBranch ?? "");
    fetch("/api/admin/laravel-security/rules")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setRules(data.data);
        setEnabledRuleCodes(new Set(data.data.filter((r: RuleRow) => r.Enabled).map((r: RuleRow) => r.RuleCode)));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleRule(code: string) {
    setEnabledRuleCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function splitList(value: string): string[] | undefined {
    const items = value.split(",").map((s) => s.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/laravel-security/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          branch: branch || undefined,
          scanType,
          includedDirectories: splitList(includedDirectories),
          excludedDirectories: splitList(excludedDirectories),
          enabledRuleCodes: rules.length > 0 ? Array.from(enabledRuleCodes) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to start scan.");
      toast.show({ type: "success", message: `Scan started for ${projectName}.` });
      onStarted?.(data.data.scanId);
      onClose();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to start scan." });
    } finally {
      setSubmitting(false);
    }
  }

  const categories = Array.from(new Set(rules.map((r) => r.Category)));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Start Scan — ${projectName}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="start-ls-scan-form" disabled={submitting}>
            {submitting ? "Starting…" : "Start Scan"}
          </Button>
        </>
      }
    >
      <form id="start-ls-scan-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>Branch</label>
            <input style={fieldStyle} value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" />
          </div>
          <div>
            <label style={labelStyle}>Scan Type</label>
            <select style={fieldStyle} value={scanType} onChange={(e) => setScanType(e.target.value as "Full" | "Incremental")}>
              <option value="Full">Full</option>
              <option value="Incremental">Incremental</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Included Directories (comma-separated, relative to source path — leave blank for all)</label>
          <input style={fieldStyle} value={includedDirectories} onChange={(e) => setIncludedDirectories(e.target.value)} placeholder="app, routes" />
        </div>
        <div>
          <label style={labelStyle}>Additional Excluded Directories (comma-separated)</label>
          <input style={fieldStyle} value={excludedDirectories} onChange={(e) => setExcludedDirectories(e.target.value)} placeholder="vendor, storage" />
        </div>

        {rules.length > 0 && (
          <div>
            <label style={labelStyle}>Enabled Security Rules</label>
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem" }}>
              {categories.map((cat) => (
                <div key={cat} style={{ marginBottom: "0.5rem" }}>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: "0.25rem" }}>{cat}</div>
                  {rules.filter((r) => r.Category === cat).map((rule) => (
                    <label key={rule.RuleCode} className="flex items-center gap-2" style={{ fontSize: "0.8rem", padding: "0.15rem 0", cursor: "pointer" }}>
                      <input type="checkbox" checked={enabledRuleCodes.has(rule.RuleCode)} onChange={() => toggleRule(rule.RuleCode)} />
                      {rule.RuleName}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

interface Settings {
  ComplexityLowMax: number;
  ComplexityMediumMax: number;
  ComplexityHighMax: number;
  DuplicationThresholdPercent: number;
  MinDuplicateBlockSize: number;
  MaxLineLength: number;
  WeightComplexity: number;
  WeightDuplication: number;
  WeightDeadCode: number;
  WeightUnusedVariables: number;
  WeightUnusedFunctions: number;
  WeightCodingStandards: number;
  ExcludedDirectories: string | null;
  AllowedExtensions: string;
  MaxScanSizeMb: number;
  ScanTimeoutSeconds: number;
  RetentionDays: number;
}

interface Rule {
  Id: number;
  RuleCode: string;
  RuleName: string;
  Description: string | null;
  Category: string;
  DefaultSeverity: string;
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

export function SettingsClient({ canManage }: { canManage?: boolean }) {
  const toast = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [excludedDirsText, setExcludedDirsText] = useState("");
  const [extensionsText, setExtensionsText] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    fetch("/api/admin/code-quality/settings").then((r) => r.json()).then((data) => {
      if (!data.ok || !data.data) return;
      setSettings(data.data);
      try {
        setExcludedDirsText((JSON.parse(data.data.ExcludedDirectories ?? "[]") as string[]).join(", "));
      } catch {
        setExcludedDirsText("");
      }
      setExtensionsText(data.data.AllowedExtensions ?? "");
    });
    fetch("/api/admin/code-quality/rules").then((r) => r.json()).then((data) => {
      if (data.ok) setRules(data.data);
    });
  }, []);

  function setField<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/code-quality/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complexityLowMax: settings.ComplexityLowMax,
          complexityMediumMax: settings.ComplexityMediumMax,
          complexityHighMax: settings.ComplexityHighMax,
          duplicationThresholdPercent: settings.DuplicationThresholdPercent,
          minDuplicateBlockSize: settings.MinDuplicateBlockSize,
          maxLineLength: settings.MaxLineLength,
          weightComplexity: settings.WeightComplexity,
          weightDuplication: settings.WeightDuplication,
          weightDeadCode: settings.WeightDeadCode,
          weightUnusedVariables: settings.WeightUnusedVariables,
          weightUnusedFunctions: settings.WeightUnusedFunctions,
          weightCodingStandards: settings.WeightCodingStandards,
          excludedDirectories: excludedDirsText.split(",").map((s) => s.trim()).filter(Boolean),
          allowedExtensions: extensionsText.split(",").map((s) => s.trim()).filter(Boolean),
          maxScanSizeMb: settings.MaxScanSizeMb,
          scanTimeoutSeconds: settings.ScanTimeoutSeconds,
          retentionDays: settings.RetentionDays,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save settings.");
      toast.show({ type: "success", message: "Settings saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save settings." });
    } finally {
      setSavingSettings(false);
    }
  }

  async function saveRules() {
    setSavingRules(true);
    try {
      const res = await fetch("/api/admin/code-quality/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rules.map((r) => ({ id: r.Id, enabled: r.Enabled, defaultSeverity: r.DefaultSeverity })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save rules.");
      toast.show({ type: "success", message: "Rules saved." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save rules." });
    } finally {
      setSavingRules(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton width={200} height={22} />
        <Skeleton height={200} />
      </div>
    );
  }

  const weightTotal = settings.WeightComplexity + settings.WeightDuplication + settings.WeightDeadCode + settings.WeightUnusedVariables + settings.WeightUnusedFunctions + settings.WeightCodingStandards;

  return (
    <div className="flex flex-col" style={{ gap: "1.25rem", maxWidth: 820 }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Rules &amp; Settings</h1>

      <Card>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Complexity Thresholds</h3>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>
          A function&apos;s complexity is banded as Low (≤ Low Max), Medium, High, or Critical. Issues are only raised above the Low Max ceiling.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div>
            <label style={labelStyle}>Low Max</label>
            <input type="number" style={fieldStyle} value={settings.ComplexityLowMax} onChange={(e) => setField("ComplexityLowMax", Number(e.target.value))} disabled={!canManage} />
          </div>
          <div>
            <label style={labelStyle}>Medium Max</label>
            <input type="number" style={fieldStyle} value={settings.ComplexityMediumMax} onChange={(e) => setField("ComplexityMediumMax", Number(e.target.value))} disabled={!canManage} />
          </div>
          <div>
            <label style={labelStyle}>High Max (above = Critical)</label>
            <input type="number" style={fieldStyle} value={settings.ComplexityHighMax} onChange={(e) => setField("ComplexityHighMax", Number(e.target.value))} disabled={!canManage} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Duplication</h3>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label style={labelStyle}>Duplication Threshold %</label>
            <input type="number" style={fieldStyle} value={settings.DuplicationThresholdPercent} onChange={(e) => setField("DuplicationThresholdPercent", Number(e.target.value))} disabled={!canManage} />
          </div>
          <div>
            <label style={labelStyle}>Minimum Duplicated Block Size (lines)</label>
            <input type="number" style={fieldStyle} value={settings.MinDuplicateBlockSize} onChange={(e) => setField("MinDuplicateBlockSize", Number(e.target.value))} disabled={!canManage} />
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Scan Scope</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label style={labelStyle}>Excluded Directories (comma-separated)</label>
            <input style={fieldStyle} value={excludedDirsText} onChange={(e) => setExcludedDirsText(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label style={labelStyle}>Allowed File Extensions (comma-separated)</label>
            <input style={fieldStyle} value={extensionsText} onChange={(e) => setExtensionsText(e.target.value)} disabled={!canManage} />
          </div>
          <div>
            <label style={labelStyle}>Max Line Length (Coding Standards)</label>
            <input type="number" style={fieldStyle} value={settings.MaxLineLength} onChange={(e) => setField("MaxLineLength", Number(e.target.value))} disabled={!canManage} />
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Max Scan Size (MB)</label>
              <input type="number" style={fieldStyle} value={settings.MaxScanSizeMb} onChange={(e) => setField("MaxScanSizeMb", Number(e.target.value))} disabled={!canManage} />
            </div>
            <div>
              <label style={labelStyle}>Scan Timeout (seconds)</label>
              <input type="number" style={fieldStyle} value={settings.ScanTimeoutSeconds} onChange={(e) => setField("ScanTimeoutSeconds", Number(e.target.value))} disabled={!canManage} />
            </div>
            <div>
              <label style={labelStyle}>Retention Period (days)</label>
              <input type="number" style={fieldStyle} value={settings.RetentionDays} onChange={(e) => setField("RetentionDays", Number(e.target.value))} disabled={!canManage} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "0.95rem" }}>Quality Score Weights</h3>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", color: (weightTotal === 100 ? "var(--ink-muted)" : "var(--warning)") }}>
          Current total: {weightTotal}% {weightTotal !== 100 && "— weights are normalized automatically, but 100% keeps them easy to reason about."}
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {([
            ["WeightComplexity", "Complexity"],
            ["WeightDuplication", "Duplication"],
            ["WeightDeadCode", "Dead Code"],
            ["WeightUnusedVariables", "Unused Variables"],
            ["WeightUnusedFunctions", "Unused Functions"],
            ["WeightCodingStandards", "Coding Standards"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <label style={labelStyle}>{label} %</label>
              <input type="number" style={fieldStyle} value={settings[key]} onChange={(e) => setField(key, Number(e.target.value))} disabled={!canManage} />
            </div>
          ))}
        </div>
      </Card>

      {canManage && (
        <div>
          <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save Settings"}</Button>
        </div>
      )}

      <Card>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem" }}>Quality Rules</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Rule</th>
              <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Category</th>
              <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Severity</th>
              <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Enabled</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.5rem 0.6rem" }}>
                  <div>{rule.RuleName}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--ink-muted)" }}>{rule.Description}</div>
                </td>
                <td style={{ padding: "0.5rem 0.6rem" }}>{rule.Category}</td>
                <td style={{ padding: "0.5rem 0.6rem" }}>
                  <select
                    style={{ ...fieldStyle, width: 120 }}
                    value={rule.DefaultSeverity}
                    disabled={!canManage}
                    onChange={(e) => setRules((prev) => prev.map((r) => (r.Id === rule.Id ? { ...r, DefaultSeverity: e.target.value } : r)))}
                  >
                    {["Low", "Medium", "High", "Critical"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "0.5rem 0.6rem" }}>
                  <input
                    type="checkbox"
                    checked={rule.Enabled}
                    disabled={!canManage}
                    onChange={(e) => setRules((prev) => prev.map((r) => (r.Id === rule.Id ? { ...r, Enabled: e.target.checked } : r)))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {canManage && (
        <div>
          <Button onClick={saveRules} disabled={savingRules}>{savingRules ? "Saving…" : "Save Rules"}</Button>
        </div>
      )}
    </div>
  );
}

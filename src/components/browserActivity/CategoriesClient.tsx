"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { LookupTableCRUD } from "@/components/settings/LookupTableCRUD";

interface DomainCategory {
  id: number;
  name: string;
  riskLevel: string;
  isBuiltIn: boolean;
}

interface DomainCategoryRule {
  id: number;
  domain: string;
  categoryId: number;
  matchType: string;
  source: string;
}

const RISK_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

function RulesPanel({ initialRules, categories }: { initialRules: DomainCategoryRule[]; categories: DomainCategory[] }) {
  const toast = useToast();
  const [rules, setRules] = useState(initialRules);
  const [domain, setDomain] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [matchType, setMatchType] = useState("suffix");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; domain: string } | null>(null);

  async function addRule() {
    if (!domain.trim() || !categoryId) {
      toast.show({ type: "error", message: "Domain and category are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/browser-activity/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim().toLowerCase(), categoryId: Number(categoryId), matchType }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add rule.");
      setRules((prev) => [...prev, { id: data.data.id, domain: domain.trim().toLowerCase(), categoryId: Number(categoryId), matchType, source: "manual" }]);
      setDomain("");
      setCategoryId("");
      toast.show({ type: "success", message: "Rule added." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add rule." });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/browser-activity/category-rules/${deleteTarget.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove rule.");
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.show({ type: "success", message: "Rule removed." });
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to remove rule." });
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Domain Classification Rules</h3>
      <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
        Maps a domain (or domain suffix) to a category. Exact matches always win over suffix matches; among suffix matches, the most specific (longest) wins.
      </p>
      <div className="flex items-end gap-2" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>Domain</label>
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            style={{ width: "100%", padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.83rem" }}
          />
        </div>
        <div style={{ width: 160 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>Category</label>
          <Select value={categoryId} onChange={setCategoryId} options={categories.map((c) => ({ label: c.name, value: String(c.id) }))} placeholder="Select category" />
        </div>
        <div style={{ width: 140 }}>
          <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)", display: "block", marginBottom: 4 }}>Match Type</label>
          <Select value={matchType} onChange={setMatchType} options={[{ label: "Suffix", value: "suffix" }, { label: "Exact", value: "exact" }]} />
        </div>
        <Button size="sm" onClick={addRule} disabled={saving}>
          <Plus size={14} /> Add
        </Button>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Domain</th>
              <th style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Category</th>
              <th style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Match Type</th>
              <th style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Source</th>
              <th style={{ width: 50 }} />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.domain}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{categories.find((c) => c.id === r.categoryId)?.name ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", textTransform: "capitalize" }}>{r.matchType}</td>
                <td style={{ padding: "0.4rem 0.6rem", textTransform: "capitalize" }}>{r.source}</td>
                <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>
                  <button onClick={() => setDeleteTarget({ id: r.id, domain: r.domain })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  No classification rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Remove rule for "${deleteTarget?.domain ?? ""}"?`}
        message="Visits to this domain will fall back to whatever the next-best matching rule classifies them as, or Uncategorized."
        confirmLabel="Remove"
        tone="danger"
      />
    </Card>
  );
}

function CategoriesInner({ categories, rules }: { categories: DomainCategory[]; rules: DomainCategoryRule[] }) {
  return (
    <div className="flex flex-col gap-4">
      <LookupTableCRUD
        title="Domain Categories"
        apiBase="/api/admin/browser-activity/categories"
        rows={categories.map((c) => ({ Id: c.id, Name: c.name, RiskLevel: c.riskLevel }))}
        fields={[
          { key: "name", label: "Category Name", type: "text", required: true },
          { key: "riskLevel", label: "Risk Level", type: "select", options: RISK_OPTIONS },
        ]}
        columns={[
          { key: "Name", label: "Name" },
          { key: "RiskLevel", label: "Risk Level", render: (row) => <span style={{ textTransform: "capitalize" }}>{String(row.RiskLevel ?? "none")}</span> },
        ]}
      />
      <RulesPanel initialRules={rules} categories={categories} />
    </div>
  );
}

export function CategoriesClient({ categories, rules }: { categories: DomainCategory[]; rules: DomainCategoryRule[] }) {
  return (
    <ToastProvider>
      <CategoriesInner categories={categories} rules={rules} />
    </ToastProvider>
  );
}

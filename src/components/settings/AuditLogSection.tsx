"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatUtcTimestamp } from "@/lib/formatUtcTimestamp";
import { parseJsonResponse } from "@/lib/apiFetch";

interface AuditRow {
  Id: number;
  Username: string;
  Section: string;
  Action: string;
  Details: string | null;
  IpAddress: string | null;
  CreatedAt: string;
}

interface ChainVerificationResult {
  ok: boolean;
  totalRows: number;
  checkedRows: number;
  brokenAtId?: number;
  reason?: string;
}

export function AuditLogSection({ rows }: { rows: AuditRow[] }) {
  const t = useTranslations("settings.auditLog");
  const [sectionFilter, setSectionFilter] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<ChainVerificationResult | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const sectionOptions = useMemo(() => {
    const sections = Array.from(new Set(rows.map((r) => r.Section)));
    return sections.map((s) => ({ label: s.replace(/_/g, " "), value: s }));
  }, [rows]);

  const filtered = sectionFilter ? rows.filter((r) => r.Section === sectionFilter) : rows;

  async function handleVerify() {
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const res = await fetch("/api/admin/settings/audit-log/verify", { method: "POST" });
      const data = (await parseJsonResponse(res)) as { ok: boolean; error?: string; data?: ChainVerificationResult };
      if (!res.ok || !data.ok) throw new Error(data.error ?? t("verifyFailedError"));
      setVerifyResult(data.data!);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : t("verifyFailedError"));
    } finally {
      setVerifying(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const url = sectionFilter ? `/api/admin/settings/audit-log/export?section=${encodeURIComponent(sectionFilter)}` : "/api/admin/settings/audit-log/export";
      const res = await fetch(url);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // Silent - a failed export isn't worth a dedicated error banner for a download action.
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3" id="field-audit-logs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 style={{ fontSize: "1rem", margin: 0, color: "var(--ink)" }}>{t("title")}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div style={{ minWidth: 200 }}>
            <Select value={sectionFilter} onChange={setSectionFilter} options={sectionOptions} placeholder={t("allSectionsPlaceholder")} />
          </div>
          <Button variant="secondary" onClick={handleExport} disabled={exporting}>
            {exporting ? t("exporting") : t("exportButton")}
          </Button>
          <Button variant="secondary" onClick={handleVerify} disabled={verifying}>
            {verifying ? t("verifying") : t("verifyButton")}
          </Button>
        </div>
      </div>
      <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", margin: 0 }}>
        {t("description")}
      </p>
      {verifyError && (
        <p style={{ fontSize: "0.8rem", color: "var(--danger, #dc2626)", margin: 0 }}>{verifyError}</p>
      )}
      {verifyResult && (
        <p style={{ fontSize: "0.8rem", color: verifyResult.ok ? "var(--success, #16a34a)" : "var(--danger, #dc2626)", margin: 0 }}>
          {verifyResult.ok
            ? t("chainValid", { checked: verifyResult.checkedRows, total: verifyResult.totalRows })
            : t("chainBroken", { id: verifyResult.brokenAtId ?? 0, reason: verifyResult.reason ?? "" })}
        </p>
      )}
      <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {[t("userColumn"), t("sectionColumn"), t("actionColumn"), t("detailsColumn"), t("ipColumn"), t("whenColumn")].map((h) => (
                <th key={h} style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.Id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.Username}</td>
                <td style={{ padding: "0.4rem 0.6rem" }}>
                  <Badge tone="neutral">{r.Section.replace(/_/g, " ")}</Badge>
                </td>
                <td style={{ padding: "0.4rem 0.6rem" }}>{r.Action.replace(/_/g, " ")}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.Details ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{r.IpAddress ?? "—"}</td>
                <td style={{ padding: "0.4rem 0.6rem", color: "var(--ink-muted)" }}>{formatUtcTimestamp(r.CreatedAt)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "1rem", textAlign: "center", color: "var(--ink-muted)" }}>
                  {t("noEntriesFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}


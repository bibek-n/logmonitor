"use client";

import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { QaTable, type QaTableColumn, type QaTablePagination } from "@/components/qa/QaTable";
import { riskBadgeStyle, formatDwell } from "./riskTones";

interface BrowserActivityEventRow {
  id: number;
  deviceId: string;
  staffId: number | null;
  browser: string;
  domain: string;
  pageTitle: string | null;
  visitedAt: string;
  dwellSeconds: number | null;
  categoryName: string | null;
  riskLevel: string;
  isSecurityEvent: boolean;
}

const inputStyle: React.CSSProperties = { padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem" };

const BROWSERS = [
  { label: "Chrome", value: "chrome" },
  { label: "Edge", value: "edge" },
  { label: "Firefox", value: "firefox" },
];

const RISK_LEVELS = [
  { label: "None", value: "none" },
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
];

export function EventsClient({ canExport }: { canExport: boolean }) {
  const [domain, setDomain] = useState("");
  const [browser, setBrowser] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<BrowserActivityEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (domain) sp.set("domain", domain);
    if (browser) sp.set("browser", browser);
    if (riskLevel) sp.set("riskLevel", riskLevel);
    if (dateFrom) sp.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) sp.set("dateTo", new Date(dateTo).toISOString());

    fetch(`/api/admin/browser-activity/events?${sp.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) {
          setRows(data.data.events);
          setTotal(data.data.total);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [domain, browser, riskLevel, dateFrom, dateTo, page]);

  function buildExportUrl(format: "csv" | "pdf") {
    const sp = new URLSearchParams();
    if (domain) sp.set("domain", domain);
    if (browser) sp.set("browser", browser);
    if (riskLevel) sp.set("riskLevel", riskLevel);
    if (dateFrom) sp.set("dateFrom", new Date(dateFrom).toISOString());
    if (dateTo) sp.set("dateTo", new Date(dateTo).toISOString());
    return `/api/admin/browser-activity/export/${format}?${sp.toString()}`;
  }

  const pagination: QaTablePagination = { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };

  const columns: QaTableColumn<BrowserActivityEventRow>[] = [
    { key: "visitedAt", label: "Visited At", render: (r) => new Date(r.visitedAt).toLocaleString() },
    { key: "domain", label: "Domain", render: (r) => r.domain },
    { key: "pageTitle", label: "Page Title", render: (r) => r.pageTitle ?? "—" },
    { key: "browser", label: "Browser", render: (r) => <span style={{ textTransform: "capitalize" }}>{r.browser}</span> },
    { key: "dwellSeconds", label: "Est. Time", render: (r) => formatDwell(r.dwellSeconds) },
    { key: "categoryName", label: "Category", render: (r) => <span style={riskBadgeStyle(r.riskLevel)}>{r.categoryName ?? "Uncategorized"}</span> },
    { key: "deviceId", label: "Device", hideByDefault: true, render: (r) => r.deviceId.slice(0, 8) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
          <input placeholder="Search domain..." value={domain} onChange={(e) => { setDomain(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 180 }} />
          <div style={{ width: 140 }}>
            <Select value={browser} onChange={(v) => { setBrowser(v); setPage(1); }} placeholder="All browsers" options={BROWSERS} />
          </div>
          <div style={{ width: 140 }}>
            <Select value={riskLevel} onChange={(v) => { setRiskLevel(v); setPage(1); }} placeholder="All risk levels" options={RISK_LEVELS} />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} style={inputStyle} />
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} style={inputStyle} />
        </div>
        {canExport && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => window.open(buildExportUrl("csv"), "_blank")}>
              <Download size={14} /> CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.open(buildExportUrl("pdf"), "_blank")}>
              <FileText size={14} /> PDF
            </Button>
          </div>
        )}
      </div>

      <QaTable
        storageKey="browser-activity-events"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No browser activity events found for this filter."
      />
    </div>
  );
}

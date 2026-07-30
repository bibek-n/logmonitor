"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { QaTable, type QaTableColumn, type QaTablePagination } from "@/components/qa/QaTable";
import { riskBadgeStyle } from "./riskTones";

interface SecurityAlertRow {
  id: number;
  deviceId: string;
  domain: string;
  visitedAt: string;
  browser: string;
  riskLevel: string;
  securityEventType: string | null;
  categoryName: string | null;
}

export function SecurityAlertsClient() {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SecurityAlertRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 25;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/browser-activity/security-alerts?page=${page}&pageSize=${pageSize}`)
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
  }, [page]);

  const pagination: QaTablePagination = { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };

  const columns: QaTableColumn<SecurityAlertRow>[] = [
    { key: "visitedAt", label: "Visited At", render: (r) => new Date(r.visitedAt).toLocaleString() },
    { key: "domain", label: "Domain", render: (r) => r.domain },
    { key: "securityEventType", label: "Type", render: (r) => <span style={riskBadgeStyle("blocked")}>{r.securityEventType ?? "blocked_domain"}</span> },
    { key: "categoryName", label: "Category", render: (r) => r.categoryName ?? "Uncategorized" },
    { key: "browser", label: "Browser", render: (r) => <span style={{ textTransform: "capitalize" }}>{r.browser}</span> },
    { key: "deviceId", label: "Device", render: (r) => r.deviceId.slice(0, 8) },
  ];

  return (
    <div className="flex flex-col gap-3">
      {total > 0 && (
        <div className="flex items-center gap-2" style={{ padding: "0.6rem 0.9rem", borderRadius: 10, background: "rgba(239,68,68,0.1)", color: "var(--danger)", fontSize: "0.85rem" }}>
          <AlertTriangle size={16} />
          {total} security-flagged visit{total === 1 ? "" : "s"} in the retained history window.
        </div>
      )}
      <QaTable
        storageKey="browser-activity-security-alerts"
        columns={columns}
        rows={rows}
        getRowId={(r) => r.id}
        loading={loading}
        pagination={pagination}
        onPageChange={setPage}
        emptyMessage="No security-flagged domain visits."
      />
    </div>
  );
}

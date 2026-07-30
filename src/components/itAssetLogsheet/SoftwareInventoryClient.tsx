"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SOFTWARE_STATUS_TONE, humanize } from "./statusTones";

interface Row {
  id: number;
  assetId: number;
  assetTag: string;
  softwareName: string;
  publisher: string | null;
  installedVersion: string | null;
  softwareStatus: string;
  licenceExpiryDate: string | null;
}

const inputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem" };
const SOFTWARE_STATUSES = ["Installed", "UpdateRequired", "Unsupported", "Unlicensed", "Approved", "Unapproved", "Removed"];

export function SoftwareInventoryClient() {
  const urlParams = useSearchParams();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState(urlParams.get("softwareStatus") ?? "");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("softwareStatus", status);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await fetch(`/api/admin/it-asset-logsheet/software?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setRows(data.data);
      setTotal(data.total);
    }
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} style={inputStyle}>
          <option value="">All Statuses</option>
          {SOFTWARE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
        </select>
      </Card>
      <div className="dash-panel">
        {rows === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No software inventory records found.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>Asset</th>
                    <th style={{ padding: "0.4rem" }}>Software</th>
                    <th style={{ padding: "0.4rem" }}>Publisher</th>
                    <th style={{ padding: "0.4rem" }}>Version</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                    <th style={{ padding: "0.4rem" }}>Licence Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}><Link href={`/dashboard/it-assets/assets/${r.assetId}`}>{r.assetTag}</Link></td>
                      <td style={{ padding: "0.4rem" }}>{r.softwareName}</td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{r.publisher ?? "—"}</td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{r.installedVersion ?? "—"}</td>
                      <td style={{ padding: "0.4rem" }}><Badge tone={SOFTWARE_STATUS_TONE[r.softwareStatus] ?? "neutral"}>{humanize(r.softwareStatus)}</Badge></td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{r.licenceExpiryDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              <span>{total} record{total === 1 ? "" : "s"}</span>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <span>Page {page} of {totalPages}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

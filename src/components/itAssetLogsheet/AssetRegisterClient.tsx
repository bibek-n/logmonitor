"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ASSET_STATUS_TONE, CRITICALITY_TONE, humanize } from "./statusTones";

interface AssetRow {
  id: number;
  assetTag: string;
  hostname: string | null;
  deviceName: string | null;
  assetType: string;
  status: string;
  criticality: string;
  department: string | null;
  location: string | null;
  assignedUser: string | null;
  ipAddress: string | null;
}

const inputStyle = {
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const ASSET_TYPES = ["Server", "Desktop", "Laptop", "VirtualMachine", "Firewall", "Router", "Switch", "StorageDevice", "Printer", "Other"];
const STATUSES = ["Active", "Inactive", "UnderMaintenance", "Retired", "Disposed", "Lost", "Spare"];
const CRITICALITIES = ["Critical", "High", "Medium", "Low"];

function AssetRegisterInner() {
  const toast = useToast();
  const urlParams = useSearchParams();
  const [assets, setAssets] = useState<AssetRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [assetType, setAssetType] = useState(urlParams.get("assetType") ?? "");
  const [status, setStatus] = useState(urlParams.get("status") ?? "");
  const [criticality, setCriticality] = useState(urlParams.get("criticality") ?? "");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (assetType) params.set("assetType", assetType);
    if (status) params.set("status", status);
    if (criticality) params.set("criticality", criticality);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    const res = await fetch(`/api/admin/it-asset-logsheet/assets?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.ok) {
      setAssets(data.data);
      setTotal(data.total);
    }
  }, [search, assetType, status, criticality, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeAsset(id: number, assetTag: string) {
    if (!confirm(`Delete asset "${assetTag}"? It will be archived, not permanently removed, and remains visible in audit history.`)) return;
    const res = await fetch(`/api/admin/it-asset-logsheet/assets/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Delete failed." });
      return;
    }
    toast.show({ type: "success", message: `${assetTag} archived.` });
    await load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Search asset tag, hostname, serial, IP..."
              style={{ ...inputStyle, minWidth: 260 }}
            />
            <select value={assetType} onChange={(e) => { setPage(1); setAssetType(e.target.value); }} style={inputStyle}>
              <option value="">All Types</option>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
            <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }} style={inputStyle}>
              <option value="">All Statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
            <select value={criticality} onChange={(e) => { setPage(1); setCriticality(e.target.value); }} style={inputStyle}>
              <option value="">All Criticality</option>
              {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Link href="/dashboard/it-assets/assets/new">
            <Button>+ Add Asset</Button>
          </Link>
        </div>
      </Card>

      <div className="dash-panel">
        {assets === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : assets.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No assets found.</p>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                    <th style={{ padding: "0.4rem" }}>Asset Tag</th>
                    <th style={{ padding: "0.4rem" }}>Hostname</th>
                    <th style={{ padding: "0.4rem" }}>Type</th>
                    <th style={{ padding: "0.4rem" }}>Status</th>
                    <th style={{ padding: "0.4rem" }}>Criticality</th>
                    <th style={{ padding: "0.4rem" }}>Department</th>
                    <th style={{ padding: "0.4rem" }}>Assigned User</th>
                    <th style={{ padding: "0.4rem" }}>IP Address</th>
                    <th style={{ padding: "0.4rem" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                      <td style={{ padding: "0.4rem" }}>
                        <Link href={`/dashboard/it-assets/assets/${a.id}`}>{a.assetTag}</Link>
                      </td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{a.hostname ?? a.deviceName ?? "—"}</td>
                      <td style={{ padding: "0.4rem" }}>{humanize(a.assetType)}</td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone={ASSET_STATUS_TONE[a.status] ?? "neutral"}>{humanize(a.status)}</Badge>
                      </td>
                      <td style={{ padding: "0.4rem" }}>
                        <Badge tone={CRITICALITY_TONE[a.criticality] ?? "neutral"}>{a.criticality}</Badge>
                      </td>
                      <td style={{ padding: "0.4rem" }}>{a.department ?? "—"}</td>
                      <td style={{ padding: "0.4rem" }}>{a.assignedUser ?? "—"}</td>
                      <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{a.ipAddress ?? "—"}</td>
                      <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: "0.3rem" }}>
                          <Link href={`/dashboard/it-assets/assets/${a.id}/edit`}>
                            <Button size="sm" variant="secondary">Edit</Button>
                          </Link>
                          <Button size="sm" variant="danger" onClick={() => removeAsset(a.id, a.assetTag)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
              <span>{total} asset{total === 1 ? "" : "s"}</span>
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

export function AssetRegisterClient() {
  return (
    <ToastProvider>
      <AssetRegisterInner />
    </ToastProvider>
  );
}

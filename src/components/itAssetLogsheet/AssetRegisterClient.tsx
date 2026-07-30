"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
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

interface ImportRowResult {
  rowNumber: number;
  status: "imported" | "skipped_duplicate" | "invalid";
  assetTag?: string;
  errors?: string[];
}

interface ImportSummary {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  results: ImportRowResult[];
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

const BULK_UPDATE_FIELDS: { key: string; label: string; options?: string[] }[] = [
  { key: "status", label: "Status", options: STATUSES },
  { key: "criticality", label: "Criticality", options: CRITICALITIES },
  { key: "department", label: "Department" },
  { key: "location", label: "Location" },
  { key: "assignedUser", label: "Assigned User" },
  { key: "responsibleTechnician", label: "Responsible Technician" },
];

function ImportAssetsModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function submit() {
    if (!file) return;
    setUploading(true);
    setSummary(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/it-asset-logsheet/import", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Import failed." });
      return;
    }
    setSummary(data.data);
    if (data.data.importedRows > 0) onImported();
  }

  function reset() {
    setFile(null);
    setSummary(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={reset} title="Import Assets" size="lg" footer={
      <>
        <Button variant="secondary" onClick={reset}>Close</Button>
        <Button onClick={submit} disabled={!file || uploading}>{uploading ? "Importing..." : "Import"}</Button>
      </>
    }>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <div>
          <a href="/api/admin/it-asset-logsheet/import/template" style={{ fontSize: "0.85rem" }}>Download import template (.xlsx)</a>
        </div>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={inputStyle}
        />
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
          Rows are validated with the same rules as the manual Add Asset form. Rows matching an existing asset by Asset Tag, Serial Number, Hostname, or IP Address are skipped as duplicates.
        </p>
        {summary && (
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
            <p style={{ fontWeight: 600 }}>
              Imported {summary.importedRows} of {summary.totalRows} row{summary.totalRows === 1 ? "" : "s"}
              {summary.failedRows > 0 && ` (${summary.failedRows} skipped)`}
            </p>
            {summary.results.filter((r) => r.status !== "imported").length > 0 && (
              <div style={{ maxHeight: 220, overflowY: "auto", fontSize: "0.8rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--ink-muted)" }}>
                      <th style={{ padding: "0.3rem" }}>Row</th>
                      <th style={{ padding: "0.3rem" }}>Status</th>
                      <th style={{ padding: "0.3rem" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.results.filter((r) => r.status !== "imported").map((r) => (
                      <tr key={r.rowNumber} style={{ borderTop: "1px solid var(--grid)" }}>
                        <td style={{ padding: "0.3rem" }}>{r.rowNumber}</td>
                        <td style={{ padding: "0.3rem" }}>
                          <Badge tone={r.status === "invalid" ? "danger" : "warning"}>{humanize(r.status)}</Badge>
                        </td>
                        <td style={{ padding: "0.3rem", color: "var(--ink-muted)" }}>{r.errors?.join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

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

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkField, setBulkField] = useState(BULK_UPDATE_FIELDS[0].key);
  const [bulkValue, setBulkValue] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

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
      setSelected(new Set());
    }
  }, [search, assetType, status, criticality, page]);

  useEffect(() => {
    load();
  }, [load]);

  function exportUrl(format: string): string {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (assetType) params.set("assetType", assetType);
    if (status) params.set("status", status);
    if (criticality) params.set("criticality", criticality);
    params.set("format", format);
    return `/api/admin/it-asset-logsheet/export?${params.toString()}`;
  }

  function toggleAll() {
    if (!assets) return;
    setSelected((prev) => (prev.size === assets.length ? new Set() : new Set(assets.map((a) => a.id))));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function applyBulkUpdate() {
    if (selected.size === 0 || !bulkValue.trim()) return;
    setBulkBusy(true);
    const res = await fetch("/api/admin/it-asset-logsheet/assets/bulk-update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected), patch: { [bulkField]: bulkValue } }),
    });
    const data = await res.json();
    setBulkBusy(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Bulk update failed." });
      return;
    }
    toast.show({ type: "success", message: `Updated ${data.data.updated} asset(s).` });
    setBulkValue("");
    await load();
  }

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
  const bulkFieldDef = BULK_UPDATE_FIELDS.find((f) => f.key === bulkField)!;

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
          <div style={{ display: "flex", gap: "0.5rem", position: "relative" }}>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>Import</Button>
            <div style={{ position: "relative" }}>
              <Button variant="secondary" onClick={() => setExportMenuOpen((v) => !v)}>Export ▾</Button>
              {exportMenuOpen && (
                <div
                  style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 20,
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.25)", minWidth: 120, overflow: "hidden",
                  }}
                  onMouseLeave={() => setExportMenuOpen(false)}
                >
                  {["csv", "excel", "pdf"].map((fmt) => (
                    <a
                      key={fmt}
                      href={exportUrl(fmt)}
                      onClick={() => setExportMenuOpen(false)}
                      style={{ display: "block", padding: "0.5rem 0.8rem", fontSize: "0.85rem", color: "var(--ink)" }}
                    >
                      {fmt.toUpperCase()}
                    </a>
                  ))}
                </div>
              )}
            </div>
            <Link href="/dashboard/it-assets/assets/new">
              <Button>+ Add Asset</Button>
            </Link>
          </div>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ fontSize: "0.85rem" }}>{selected.size} selected</strong>
            <select value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue(""); }} style={inputStyle}>
              {BULK_UPDATE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            {bulkFieldDef.options ? (
              <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} style={inputStyle}>
                <option value="">Select value...</option>
                {bulkFieldDef.options.map((o) => <option key={o} value={o}>{humanize(o)}</option>)}
              </select>
            ) : (
              <input value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} placeholder={`New ${bulkFieldDef.label}`} style={inputStyle} />
            )}
            <Button size="sm" disabled={!bulkValue.trim() || bulkBusy} onClick={applyBulkUpdate}>
              {bulkBusy ? "Applying..." : "Apply to Selected"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        </Card>
      )}

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
                    <th style={{ padding: "0.4rem" }}>
                      <input type="checkbox" checked={selected.size === assets.length} onChange={toggleAll} />
                    </th>
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
                        <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} />
                      </td>
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

      <ImportAssetsModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
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

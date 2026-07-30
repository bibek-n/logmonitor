"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import {
  ASSET_STATUS_TONE,
  CRITICALITY_TONE,
  PASSWORD_STATUS_TONE,
  PATCH_SEVERITY_TONE,
  INSTALLATION_STATUS_TONE,
  SOFTWARE_STATUS_TONE,
  MAINTENANCE_STATUS_TONE,
  humanize,
} from "./statusTones";

type TabKey = "overview" | "hardware" | "passwords" | "patches" | "software" | "maintenance" | "attachments" | "audit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "hardware", label: "Hardware & System" },
  { key: "passwords", label: "Password History" },
  { key: "patches", label: "Patch History" },
  { key: "software", label: "Software Inventory" },
  { key: "maintenance", label: "Maintenance History" },
  { key: "attachments", label: "Attachments" },
  { key: "audit", label: "Audit History" },
];

interface AssetDetail {
  asset: Record<string, unknown>;
  passwordLogs: Record<string, unknown>[];
  patchLogs: Record<string, unknown>[];
  software: Record<string, unknown>[];
  maintenance: Record<string, unknown>[];
}

function row(label: string, value: unknown) {
  return (
    <tr style={{ borderBottom: "1px solid var(--grid)" }}>
      <td style={{ padding: "0.4rem", color: "var(--ink-muted)", width: "40%" }}>{label}</td>
      <td style={{ padding: "0.4rem" }}>{value == null || value === "" ? "—" : String(value)}</td>
    </tr>
  );
}

function AssetDetailInner({ assetId }: { assetId: number }) {
  const toast = useToast();
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/it-asset-logsheet/assets/${assetId}`);
    const data = await res.json();
    if (res.ok && data.ok) setDetail(data.data);
    else toast.show({ type: "error", message: data.error ?? "Failed to load asset." });
  }, [assetId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;
  const a = detail.asset;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{a.assetTag as string}</h1>
          <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
            <Badge tone={ASSET_STATUS_TONE[a.status as string] ?? "neutral"}>{humanize(a.status as string)}</Badge>
            <Badge tone={CRITICALITY_TONE[a.criticality as string] ?? "neutral"}>{a.criticality as string}</Badge>
          </div>
        </div>
        <Link href={`/dashboard/it-assets/assets/${assetId}/edit`}>
          <Button variant="secondary">Edit Asset</Button>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", borderBottom: "1px solid var(--border)", marginBottom: "1rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "0.5rem 0.8rem",
              background: "none",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.key ? "var(--ink)" : "var(--ink-muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: tab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dash-panel">
        {tab === "overview" && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {row("Asset Tag", a.assetTag)}
              {row("Hostname", a.hostname)}
              {row("Device Name", a.deviceName)}
              {row("Asset Type", humanize(a.assetType as string))}
              {row("Device Category", a.deviceCategory)}
              {row("Department", a.department)}
              {row("Location", a.location)}
              {row("Assigned User", a.assignedUser)}
              {row("Asset Owner", a.assetOwner)}
              {row("Responsible Technician", a.responsibleTechnician)}
              {row("Environment", a.environment)}
              {row("Purchase Date", a.purchaseDate)}
              {row("Warranty Expiry", a.warrantyExpiryDate)}
              {row("Installation Date", a.installationDate)}
              {row("Last Inventory Check", a.lastInventoryCheckDate)}
              {row("Next Inventory Check", a.nextInventoryCheckDate)}
              {row("Notes", a.notes)}
              {row("Created By", `${a.createdByUsername ?? "—"}`)}
              {row("Last Modified By", `${a.updatedByUsername ?? "—"}`)}
            </tbody>
          </table>
        )}

        {tab === "hardware" && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {row("Manufacturer", a.manufacturer)}
              {row("Model", a.model)}
              {row("Serial Number", a.serialNumber)}
              {row("Operating System", a.operatingSystem)}
              {row("OS Version", a.osVersion)}
              {row("IP Address", a.ipAddress)}
              {row("MAC Address", a.macAddress)}
              {row("Domain / Workgroup", a.domainOrWorkgroup)}
              {row("Physical / Virtual", a.isVirtual ? "Virtual" : "Physical")}
            </tbody>
          </table>
        )}

        {tab === "passwords" && (
          <SimpleTable
            columns={["Account/Service", "Type", "Last Changed", "Next Change", "Status"]}
            rows={detail.passwordLogs.map((p) => [
              p.accountOrServiceName as string,
              humanize(p.accountType as string),
              (p.lastPasswordChangeDate as string) ?? "—",
              (p.nextPasswordChangeDate as string) ?? "—",
              <Badge key="s" tone={PASSWORD_STATUS_TONE[p.status as string] ?? "neutral"}>{humanize(p.status as string)}</Badge>,
            ])}
            empty="No password change records yet."
          />
        )}

        {tab === "patches" && (
          <SimpleTable
            columns={["Patch", "Type", "Severity", "Status", "Installed"]}
            rows={detail.patchLogs.map((p) => [
              p.patchName as string,
              humanize(p.updateType as string),
              <Badge key="sev" tone={PATCH_SEVERITY_TONE[p.severity as string] ?? "neutral"}>{p.severity as string}</Badge>,
              <Badge key="st" tone={INSTALLATION_STATUS_TONE[p.installationStatus as string] ?? "neutral"}>{humanize(p.installationStatus as string)}</Badge>,
              (p.actualInstallationDate as string) ?? "—",
            ])}
            empty="No patch records yet."
          />
        )}

        {tab === "software" && (
          <SimpleTable
            columns={["Software", "Publisher", "Version", "Status", "Licence Expiry"]}
            rows={detail.software.map((s) => [
              s.softwareName as string,
              (s.publisher as string) ?? "—",
              (s.installedVersion as string) ?? "—",
              <Badge key="st" tone={SOFTWARE_STATUS_TONE[s.softwareStatus as string] ?? "neutral"}>{humanize(s.softwareStatus as string)}</Badge>,
              (s.licenceExpiryDate as string) ?? "—",
            ])}
            empty="No software inventory recorded yet."
          />
        )}

        {tab === "maintenance" && (
          <SimpleTable
            columns={["Activity", "Type", "Status", "Scheduled", "Performed By"]}
            rows={detail.maintenance.map((m) => [
              m.activityTitle as string,
              humanize(m.activityType as string),
              <Badge key="st" tone={MAINTENANCE_STATUS_TONE[m.status as string] ?? "neutral"}>{humanize(m.status as string)}</Badge>,
              (m.scheduledDate as string) ?? "—",
              (m.performedBy as string) ?? "—",
            ])}
            empty="No maintenance activity logged yet."
          />
        )}

        {tab === "attachments" && <p style={{ color: "var(--ink-muted)" }}>Attachment uploads are coming in a follow-up update.</p>}
        {tab === "audit" && <p style={{ color: "var(--ink-muted)" }}>Full audit history view is coming in a follow-up update.</p>}
      </div>
    </div>
  );
}

function SimpleTable({ columns, rows, empty }: { columns: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (rows.length === 0) return <p style={{ color: "var(--ink-muted)" }}>{empty}</p>;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
            {columns.map((c) => <th key={c} style={{ padding: "0.4rem" }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--grid)" }}>
              {r.map((cell, j) => <td key={j} style={{ padding: "0.4rem" }}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssetDetailClient({ assetId }: { assetId: number }) {
  return (
    <ToastProvider>
      <AssetDetailInner assetId={assetId} />
    </ToastProvider>
  );
}

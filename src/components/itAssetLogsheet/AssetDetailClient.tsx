"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { DeviceDetailExtras } from "@/components/endpointAgents/DeviceDetailExtras";
import type {
  HardwareInfo,
  DiskRow,
  DiskSpace,
  VolumeRow,
  SecurityStatus,
  NetworkInfo,
  ProcessRow,
  ServiceRow,
  SoftwareRow,
  LocalUserRow,
  DeviceAlertRow,
  UsbEventRow,
} from "@/components/endpointAgents/DeviceDetail";
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

type TabKey = "overview" | "hardware" | "inventory" | "passwords" | "patches" | "software" | "maintenance" | "attachments" | "audit";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "hardware", label: "Hardware & System" },
  { key: "inventory", label: "Inventory & Posture" },
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

// Mirrors DeviceReportData from src/lib/endpointAgents/deviceReport.ts (the API route just
// spreads that shape onto the JSON response, plus a few identifying fields on top).
interface AssetInventory {
  deviceId: string;
  hostname: string;
  os: string;
  lastHeartbeat: string | null;
  latestMetrics: { cpuPct: number | null; memPct: number | null; diskPct: number | null } | null;
  hardware: HardwareInfo | null;
  disks: DiskRow[];
  diskSpace: DiskSpace | null;
  volumes: VolumeRow[];
  security: SecurityStatus | null;
  network: NetworkInfo | null;
  processes: ProcessRow[];
  services: ServiceRow[];
  software: SoftwareRow[];
  localUsers: LocalUserRow[];
  alerts: DeviceAlertRow[];
  usbEvents: UsbEventRow[];
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
  // undefined = not fetched yet, null = fetched but no LogMonitor agent linked to this asset.
  const [inventory, setInventory] = useState<AssetInventory | null | undefined>(undefined);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAddSoftware, setShowAddSoftware] = useState(false);
  const [savingSoftware, setSavingSoftware] = useState(false);
  const [softwareForm, setSoftwareForm] = useState({
    softwareName: "",
    publisher: "",
    installedVersion: "",
    licenceType: "",
    licenceKeyRef: "",
    numberOfLicences: "",
    licenceExpiryDate: "",
  });

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/it-asset-logsheet/assets/${assetId}`);
    const data = await res.json();
    if (res.ok && data.ok) setDetail(data.data);
    else toast.show({ type: "error", message: data.error ?? "Failed to load asset." });
  }, [assetId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetched on demand, the first time the Inventory & Posture tab is opened - this pulls a lot
  // of agent-reported detail (processes, software, alerts, etc.) that most asset-page visits
  // never need, same reasoning as the Staff page's own collapsed-by-default device report.
  useEffect(() => {
    if (tab !== "inventory" || inventory !== undefined) return;
    setInventoryLoading(true);
    fetch(`/api/admin/it-asset-logsheet/assets/${assetId}/inventory`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setInventory(data.data);
        else toast.show({ type: "error", message: data.error ?? "Failed to load inventory." });
      })
      .finally(() => setInventoryLoading(false));
  }, [tab, inventory, assetId, toast]);

  async function handleAddSoftware() {
    if (!softwareForm.softwareName.trim()) {
      toast.show({ type: "error", message: "Software name is required." });
      return;
    }
    setSavingSoftware(true);
    try {
      const res = await fetch(`/api/admin/it-asset-logsheet/assets/${assetId}/software`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          softwareName: softwareForm.softwareName.trim(),
          publisher: softwareForm.publisher.trim() || null,
          installedVersion: softwareForm.installedVersion.trim() || null,
          licenceType: softwareForm.licenceType.trim() || null,
          licenceKeyRef: softwareForm.licenceKeyRef.trim() || null,
          numberOfLicences: softwareForm.numberOfLicences.trim() ? Number(softwareForm.numberOfLicences) : null,
          licenceExpiryDate: softwareForm.licenceExpiryDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to add software.");
      toast.show({ type: "success", message: "Software record added." });
      setSoftwareForm({ softwareName: "", publisher: "", installedVersion: "", licenceType: "", licenceKeyRef: "", numberOfLicences: "", licenceExpiryDate: "" });
      setShowAddSoftware(false);
      load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to add software." });
    } finally {
      setSavingSoftware(false);
    }
  }

  if (!detail) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;
  const a = detail.asset;
  const softwareInputStyle = { padding: "0.45rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: "0.85rem", width: "100%" };

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

        {tab === "inventory" && (
          <>
            {inventoryLoading && <p style={{ color: "var(--ink-muted)" }}>Loading live inventory...</p>}
            {!inventoryLoading && inventory === null && (
              <p style={{ color: "var(--ink-muted)" }}>
                No LogMonitor agent is linked to this asset yet. This appears automatically once a LogMonitor agent enrolled on this
                asset&apos;s hostname (or the staff/server it&apos;s linked to) reports in.
              </p>
            )}
            {!inventoryLoading && inventory && (
              <DeviceDetailExtras
                hardware={inventory.hardware}
                disks={inventory.disks}
                diskSpace={inventory.diskSpace}
                volumes={inventory.volumes}
                security={inventory.security}
                network={inventory.network}
                processes={inventory.processes}
                services={inventory.services}
                software={inventory.software}
                localUsers={inventory.localUsers}
                alerts={inventory.alerts}
                usbEvents={inventory.usbEvents}
              />
            )}
          </>
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
          <div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
              <Button size="sm" variant="secondary" onClick={() => setShowAddSoftware((v) => !v)}>
                {showAddSoftware ? "Cancel" : "Add Software"}
              </Button>
            </div>
            {showAddSoftware && (
              <Card style={{ marginBottom: "1rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.6rem" }}>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Software Name *</label>
                    <input style={softwareInputStyle} value={softwareForm.softwareName} onChange={(e) => setSoftwareForm({ ...softwareForm, softwareName: e.target.value })} placeholder="e.g. Microsoft Office" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Publisher</label>
                    <input style={softwareInputStyle} value={softwareForm.publisher} onChange={(e) => setSoftwareForm({ ...softwareForm, publisher: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Version</label>
                    <input style={softwareInputStyle} value={softwareForm.installedVersion} onChange={(e) => setSoftwareForm({ ...softwareForm, installedVersion: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Licence Type</label>
                    <input style={softwareInputStyle} value={softwareForm.licenceType} onChange={(e) => setSoftwareForm({ ...softwareForm, licenceType: e.target.value })} placeholder="e.g. Volume, Subscription" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Licence Key / Vault Ref</label>
                    <input style={softwareInputStyle} value={softwareForm.licenceKeyRef} onChange={(e) => setSoftwareForm({ ...softwareForm, licenceKeyRef: e.target.value })} placeholder="Reference only, not the real key" />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Seats / Number of Licences</label>
                    <input style={softwareInputStyle} type="number" min={0} value={softwareForm.numberOfLicences} onChange={(e) => setSoftwareForm({ ...softwareForm, numberOfLicences: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Licence Expiry</label>
                    <input style={softwareInputStyle} type="date" value={softwareForm.licenceExpiryDate} onChange={(e) => setSoftwareForm({ ...softwareForm, licenceExpiryDate: e.target.value })} />
                  </div>
                </div>
                <div style={{ marginTop: "0.75rem" }}>
                  <Button size="sm" onClick={handleAddSoftware} disabled={savingSoftware}>
                    {savingSoftware ? "Saving..." : "Save Software Record"}
                  </Button>
                </div>
              </Card>
            )}
            <SimpleTable
              columns={["Software", "Publisher", "Version", "Status", "Seats", "Licence Key", "Licence Expiry"]}
              rows={detail.software.map((s) => [
                s.softwareName as string,
                (s.publisher as string) ?? "—",
                (s.installedVersion as string) ?? "—",
                <Badge key="st" tone={SOFTWARE_STATUS_TONE[s.softwareStatus as string] ?? "neutral"}>{humanize(s.softwareStatus as string)}</Badge>,
                (s.numberOfLicences as number | null) ?? "—",
                (s.licenceKeyRef as string) ?? "—",
                (s.licenceExpiryDate as string) ?? "—",
              ])}
              empty="No software inventory recorded yet."
            />
          </div>
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

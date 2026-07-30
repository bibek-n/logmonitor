"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { humanize } from "./statusTones";

const ASSET_TYPES = ["Server", "Desktop", "Laptop", "VirtualMachine", "Firewall", "Router", "Switch", "StorageDevice", "Printer", "Other"];
const STATUSES = ["Active", "Inactive", "UnderMaintenance", "Retired", "Disposed", "Lost", "Spare"];
const CRITICALITIES = ["Critical", "High", "Medium", "Low"];

const inputStyle = {
  padding: "0.5rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
  width: "100%",
};

const labelStyle = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.25rem", display: "block" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" };

interface FormState {
  assetTag: string;
  hostname: string;
  deviceName: string;
  assetType: string;
  deviceCategory: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  operatingSystem: string;
  osVersion: string;
  ipAddress: string;
  macAddress: string;
  domainOrWorkgroup: string;
  isVirtual: boolean;
  department: string;
  location: string;
  assignedUser: string;
  assetOwner: string;
  responsibleTechnician: string;
  purchaseDate: string;
  warrantyExpiryDate: string;
  installationDate: string;
  status: string;
  criticality: string;
  environment: string;
  lastInventoryCheckDate: string;
  nextInventoryCheckDate: string;
  notes: string;
}

const EMPTY: FormState = {
  assetTag: "", hostname: "", deviceName: "", assetType: "Server", deviceCategory: "", manufacturer: "", model: "",
  serialNumber: "", operatingSystem: "", osVersion: "", ipAddress: "", macAddress: "", domainOrWorkgroup: "",
  isVirtual: false, department: "", location: "", assignedUser: "", assetOwner: "", responsibleTechnician: "",
  purchaseDate: "", warrantyExpiryDate: "", installationDate: "", status: "Active", criticality: "Medium",
  environment: "", lastInventoryCheckDate: "", nextInventoryCheckDate: "", notes: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function AssetFormInner({ assetId }: { assetId?: number }) {
  const toast = useToast();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!!assetId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    (async () => {
      const res = await fetch(`/api/admin/it-asset-logsheet/assets/${assetId}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        const a = data.data.asset;
        setForm({
          assetTag: a.assetTag ?? "", hostname: a.hostname ?? "", deviceName: a.deviceName ?? "",
          assetType: a.assetType ?? "Server", deviceCategory: a.deviceCategory ?? "", manufacturer: a.manufacturer ?? "",
          model: a.model ?? "", serialNumber: a.serialNumber ?? "", operatingSystem: a.operatingSystem ?? "",
          osVersion: a.osVersion ?? "", ipAddress: a.ipAddress ?? "", macAddress: a.macAddress ?? "",
          domainOrWorkgroup: a.domainOrWorkgroup ?? "", isVirtual: !!a.isVirtual, department: a.department ?? "",
          location: a.location ?? "", assignedUser: a.assignedUser ?? "", assetOwner: a.assetOwner ?? "",
          responsibleTechnician: a.responsibleTechnician ?? "", purchaseDate: a.purchaseDate ?? "",
          warrantyExpiryDate: a.warrantyExpiryDate ?? "", installationDate: a.installationDate ?? "",
          status: a.status ?? "Active", criticality: a.criticality ?? "Medium", environment: a.environment ?? "",
          lastInventoryCheckDate: a.lastInventoryCheckDate ?? "", nextInventoryCheckDate: a.nextInventoryCheckDate ?? "",
          notes: a.notes ?? "",
        });
      }
      setLoading(false);
    })();
  }, [assetId]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (!form.assetTag.trim()) {
      toast.show({ type: "error", message: "Asset Tag is required." });
      return;
    }
    setSaving(true);
    const payload: Record<string, unknown> = { ...form };
    for (const key of Object.keys(payload)) {
      if (payload[key] === "") payload[key] = null;
    }
    const url = assetId ? `/api/admin/it-asset-logsheet/assets/${assetId}` : "/api/admin/it-asset-logsheet/assets";
    const method = assetId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json();
    setSaving(false);
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Save failed." });
      return;
    }
    toast.show({ type: "success", message: assetId ? "Asset updated." : "Asset created." });
    router.push(assetId ? `/dashboard/it-assets/assets/${assetId}` : `/dashboard/it-assets/assets/${data.data.id}`);
  }

  if (loading) return <p style={{ color: "var(--ink-muted)" }}>Loading...</p>;

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Identification</h3>
        <div style={gridStyle}>
          <Field label="Asset Tag *"><input style={inputStyle} value={form.assetTag} onChange={(e) => set("assetTag", e.target.value)} /></Field>
          <Field label="Hostname"><input style={inputStyle} value={form.hostname} onChange={(e) => set("hostname", e.target.value)} /></Field>
          <Field label="Device Name"><input style={inputStyle} value={form.deviceName} onChange={(e) => set("deviceName", e.target.value)} /></Field>
          <Field label="Asset Type">
            <select style={inputStyle} value={form.assetType} onChange={(e) => set("assetType", e.target.value)}>
              {ASSET_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </Field>
          <Field label="Device Category"><input style={inputStyle} value={form.deviceCategory} onChange={(e) => set("deviceCategory", e.target.value)} /></Field>
          <Field label="Manufacturer"><input style={inputStyle} value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} /></Field>
          <Field label="Model"><input style={inputStyle} value={form.model} onChange={(e) => set("model", e.target.value)} /></Field>
          <Field label="Serial Number"><input style={inputStyle} value={form.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} /></Field>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>System & Network</h3>
        <div style={gridStyle}>
          <Field label="Operating System"><input style={inputStyle} value={form.operatingSystem} onChange={(e) => set("operatingSystem", e.target.value)} /></Field>
          <Field label="OS Version"><input style={inputStyle} value={form.osVersion} onChange={(e) => set("osVersion", e.target.value)} /></Field>
          <Field label="IP Address"><input style={inputStyle} value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} /></Field>
          <Field label="MAC Address"><input style={inputStyle} value={form.macAddress} onChange={(e) => set("macAddress", e.target.value)} /></Field>
          <Field label="Domain / Workgroup"><input style={inputStyle} value={form.domainOrWorkgroup} onChange={(e) => set("domainOrWorkgroup", e.target.value)} /></Field>
          <Field label="Physical / Virtual">
            <select style={inputStyle} value={form.isVirtual ? "virtual" : "physical"} onChange={(e) => set("isVirtual", e.target.value === "virtual")}>
              <option value="physical">Physical</option>
              <option value="virtual">Virtual</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Ownership & Location</h3>
        <div style={gridStyle}>
          <Field label="Department"><input style={inputStyle} value={form.department} onChange={(e) => set("department", e.target.value)} /></Field>
          <Field label="Location"><input style={inputStyle} value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Assigned User"><input style={inputStyle} value={form.assignedUser} onChange={(e) => set("assignedUser", e.target.value)} /></Field>
          <Field label="Asset Owner"><input style={inputStyle} value={form.assetOwner} onChange={(e) => set("assetOwner", e.target.value)} /></Field>
          <Field label="Responsible Technician"><input style={inputStyle} value={form.responsibleTechnician} onChange={(e) => set("responsibleTechnician", e.target.value)} /></Field>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Lifecycle & Status</h3>
        <div style={gridStyle}>
          <Field label="Status">
            <select style={inputStyle} value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
            </select>
          </Field>
          <Field label="Criticality">
            <select style={inputStyle} value={form.criticality} onChange={(e) => set("criticality", e.target.value)}>
              {CRITICALITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Environment"><input style={inputStyle} value={form.environment} onChange={(e) => set("environment", e.target.value)} placeholder="e.g. Production" /></Field>
          <Field label="Purchase Date"><input type="date" style={inputStyle} value={form.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></Field>
          <Field label="Warranty Expiry Date"><input type="date" style={inputStyle} value={form.warrantyExpiryDate} onChange={(e) => set("warrantyExpiryDate", e.target.value)} /></Field>
          <Field label="Installation Date"><input type="date" style={inputStyle} value={form.installationDate} onChange={(e) => set("installationDate", e.target.value)} /></Field>
          <Field label="Last Inventory Check"><input type="date" style={inputStyle} value={form.lastInventoryCheckDate} onChange={(e) => set("lastInventoryCheckDate", e.target.value)} /></Field>
          <Field label="Next Inventory Check"><input type="date" style={inputStyle} value={form.nextInventoryCheckDate} onChange={(e) => set("nextInventoryCheckDate", e.target.value)} /></Field>
        </div>
      </Card>

      <Card style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>Notes</h3>
        <textarea
          style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </Card>

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving..." : assetId ? "Save Changes" : "Create Asset"}</Button>
      </div>
    </div>
  );
}

export function AssetFormClient({ assetId }: { assetId?: number }) {
  return (
    <ToastProvider>
      <AssetFormInner assetId={assetId} />
    </ToastProvider>
  );
}

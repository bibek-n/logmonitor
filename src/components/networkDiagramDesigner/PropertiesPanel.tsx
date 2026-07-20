"use client";

import { useState, type ReactNode } from "react";
import { Select } from "@/components/ui/Select";
import { useDesignerStore } from "@/lib/networkDiagramDesigner/store";
import { DEVICE_LIBRARY } from "@/lib/networkDiagramDesigner/deviceLibrary";
import type { NetworkDiagramNodeData, NetworkDiagramEdgeData } from "@/lib/networkDiagramDesigner/types";

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV4_CIDR_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}(\/(3[0-2]|[12]?\d))?$/;
const MAC_RE = /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/;

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: "0.6rem" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--ink-muted)", fontWeight: 600 }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: "0.68rem", color: "var(--danger)" }}>{error}</span>}
    </label>
  );
}

const textInputStyle: React.CSSProperties = {
  width: "100%", padding: "0.4rem 0.55rem", borderRadius: 8,
  border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.82rem",
};

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...textInputStyle, ...props.style }} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} style={{ ...textInputStyle, resize: "vertical", ...props.style }} />;
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-muted)", margin: "0.9rem 0 0.5rem" }}>
      {children}
    </div>
  );
}

function DevicePropertiesForm({ nodeId }: { nodeId: string }) {
  const node = useDesignerStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeData = useDesignerStore((s) => s.updateNodeData);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!node) return null;
  const data = node.data as NetworkDiagramNodeData;

  const set = <K extends keyof NetworkDiagramNodeData>(key: K, value: NetworkDiagramNodeData[K]) =>
    updateNodeData(nodeId, { [key]: value } as Partial<NetworkDiagramNodeData>);

  const validate = (key: "managementIp" | "macAddress" | "subnet" | "defaultGateway", value: string) => {
    let ok = true;
    if (value) {
      if (key === "macAddress") ok = MAC_RE.test(value);
      else if (key === "subnet") ok = IPV4_CIDR_RE.test(value);
      else ok = IPV4_RE.test(value);
    }
    setErrors((prev) => ({ ...prev, [key]: ok ? "" : "Invalid format" }));
  };

  return (
    <div>
      <SectionTitle>Identity</SectionTitle>
      <Field label="Display Name">
        <TextInput value={data.label} disabled={readOnly} onChange={(e) => set("label", e.target.value)} />
      </Field>
      <Field label="Device Type">
        <Select
          value={data.deviceType}
          onChange={(v) => set("deviceType", v as NetworkDiagramNodeData["deviceType"])}
          options={DEVICE_LIBRARY.map((d) => ({ label: d.label, value: d.type }))}
          disabled={readOnly}
        />
      </Field>
      <Field label="Hostname">
        <TextInput value={data.hostname ?? ""} disabled={readOnly} onChange={(e) => set("hostname", e.target.value)} />
      </Field>
      <Field label="Vendor">
        <TextInput value={data.vendor ?? ""} disabled={readOnly} onChange={(e) => set("vendor", e.target.value)} />
      </Field>
      <Field label="Model">
        <TextInput value={data.model ?? ""} disabled={readOnly} onChange={(e) => set("model", e.target.value)} />
      </Field>
      <Field label="Serial Number">
        <TextInput value={data.serialNumber ?? ""} disabled={readOnly} onChange={(e) => set("serialNumber", e.target.value)} />
      </Field>

      <SectionTitle>Network</SectionTitle>
      <Field label="Management IP" error={errors.managementIp}>
        <TextInput
          value={data.managementIp ?? ""} disabled={readOnly}
          onChange={(e) => { set("managementIp", e.target.value); validate("managementIp", e.target.value); }}
        />
      </Field>
      <Field label="MAC Address" error={errors.macAddress}>
        <TextInput
          value={data.macAddress ?? ""} disabled={readOnly} placeholder="aa:bb:cc:dd:ee:ff"
          onChange={(e) => { set("macAddress", e.target.value); validate("macAddress", e.target.value); }}
        />
      </Field>
      <Field label="VLAN">
        <TextInput value={data.vlan ?? ""} disabled={readOnly} onChange={(e) => set("vlan", e.target.value)} />
      </Field>
      <Field label="Subnet" error={errors.subnet}>
        <TextInput
          value={data.subnet ?? ""} disabled={readOnly} placeholder="192.168.1.0/24"
          onChange={(e) => { set("subnet", e.target.value); validate("subnet", e.target.value); }}
        />
      </Field>
      <Field label="Default Gateway" error={errors.defaultGateway}>
        <TextInput
          value={data.defaultGateway ?? ""} disabled={readOnly}
          onChange={(e) => { set("defaultGateway", e.target.value); validate("defaultGateway", e.target.value); }}
        />
      </Field>

      <SectionTitle>System</SectionTitle>
      <Field label="Operating System">
        <TextInput value={data.operatingSystem ?? ""} disabled={readOnly} onChange={(e) => set("operatingSystem", e.target.value)} />
      </Field>
      <Field label="Firmware Version">
        <TextInput value={data.firmwareVersion ?? ""} disabled={readOnly} onChange={(e) => set("firmwareVersion", e.target.value)} />
      </Field>
      <Field label="Status">
        <Select
          value={data.status ?? "active"} disabled={readOnly}
          onChange={(v) => set("status", v as NetworkDiagramNodeData["status"])}
          options={["active", "inactive", "maintenance", "planned", "decommissioned"].map((v) => ({ label: v, value: v }))}
        />
      </Field>

      <SectionTitle>Location</SectionTitle>
      <Field label="Location">
        <TextInput value={data.location ?? ""} disabled={readOnly} onChange={(e) => set("location", e.target.value)} />
      </Field>
      <Field label="Rack">
        <TextInput value={data.rack ?? ""} disabled={readOnly} onChange={(e) => set("rack", e.target.value)} />
      </Field>

      <SectionTitle>Notes</SectionTitle>
      <Field label="Notes">
        <TextArea value={data.notes ?? ""} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

function ConnectionPropertiesForm({ edgeId }: { edgeId: string }) {
  const edge = useDesignerStore((s) => s.edges.find((e) => e.id === edgeId));
  const updateEdgeData = useDesignerStore((s) => s.updateEdgeData);
  const readOnly = useDesignerStore((s) => s.readOnly);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!edge) return null;
  const data = (edge.data ?? {}) as NetworkDiagramEdgeData;

  const set = <K extends keyof NetworkDiagramEdgeData>(key: K, value: NetworkDiagramEdgeData[K]) =>
    updateEdgeData(edgeId, { [key]: value } as Partial<NetworkDiagramEdgeData>);

  const validateSubnet = (value: string) => {
    setErrors((prev) => ({ ...prev, ipSubnet: !value || IPV4_CIDR_RE.test(value) ? "" : "Invalid format" }));
  };

  return (
    <div>
      <SectionTitle>Connection</SectionTitle>
      <Field label="Connection Name">
        <TextInput value={data.label ?? ""} disabled={readOnly} onChange={(e) => set("label", e.target.value)} />
      </Field>
      <Field label="Source Interface">
        <TextInput value={data.sourceInterface ?? ""} disabled={readOnly} onChange={(e) => set("sourceInterface", e.target.value)} />
      </Field>
      <Field label="Destination Interface">
        <TextInput value={data.destinationInterface ?? ""} disabled={readOnly} onChange={(e) => set("destinationInterface", e.target.value)} />
      </Field>
      <Field label="Link Speed">
        <TextInput value={data.speed ?? ""} disabled={readOnly} placeholder="1Gbps" onChange={(e) => set("speed", e.target.value)} />
      </Field>
      <Field label="Duplex Mode">
        <Select
          value={data.duplex ?? ""} disabled={readOnly} placeholder="Select..."
          onChange={(v) => set("duplex", v as NetworkDiagramEdgeData["duplex"])}
          options={["full", "half", "auto"].map((v) => ({ label: v, value: v }))}
        />
      </Field>
      <Field label="Media Type">
        <Select
          value={data.mediaType ?? ""} disabled={readOnly} placeholder="Select..."
          onChange={(v) => set("mediaType", v as NetworkDiagramEdgeData["mediaType"])}
          options={["copper", "fiber", "wireless", "virtual"].map((v) => ({ label: v, value: v }))}
        />
      </Field>

      <SectionTitle>VLAN &amp; Routing</SectionTitle>
      <Field label="Port Mode">
        <Select
          value={data.portMode ?? ""} disabled={readOnly} placeholder="Select..."
          onChange={(v) => set("portMode", v as NetworkDiagramEdgeData["portMode"])}
          options={["access", "trunk"].map((v) => ({ label: v, value: v }))}
        />
      </Field>
      <Field label="Native VLAN">
        <TextInput value={data.nativeVlan ?? ""} disabled={readOnly} onChange={(e) => set("nativeVlan", e.target.value)} />
      </Field>
      <Field label="Allowed VLANs">
        <TextInput value={data.allowedVlans ?? ""} disabled={readOnly} onChange={(e) => set("allowedVlans", e.target.value)} />
      </Field>
      <Field label="IP Subnet" error={errors.ipSubnet}>
        <TextInput
          value={data.ipSubnet ?? ""} disabled={readOnly}
          onChange={(e) => { set("ipSubnet", e.target.value); validateSubnet(e.target.value); }}
        />
      </Field>
      <Field label="Routing Protocol">
        <TextInput value={data.routingProtocol ?? ""} disabled={readOnly} onChange={(e) => set("routingProtocol", e.target.value)} />
      </Field>

      <SectionTitle>Status</SectionTitle>
      <Field label="Link Status">
        <Select
          value={data.status ?? "up"} disabled={readOnly}
          onChange={(v) => set("status", v as NetworkDiagramEdgeData["status"])}
          options={["up", "down", "planned"].map((v) => ({ label: v, value: v }))}
        />
      </Field>
      <Field label="Primary / Backup">
        <Select
          value={data.role ?? "primary"} disabled={readOnly}
          onChange={(v) => set("role", v as NetworkDiagramEdgeData["role"])}
          options={["primary", "backup"].map((v) => ({ label: v, value: v }))}
        />
      </Field>

      <SectionTitle>Appearance</SectionTitle>
      <Field label="Line Type">
        <Select
          value={data.lineType ?? "solid"} disabled={readOnly}
          onChange={(v) => set("lineType", v as NetworkDiagramEdgeData["lineType"])}
          options={["solid", "dashed", "dotted"].map((v) => ({ label: v, value: v }))}
        />
      </Field>
      <Field label="Arrow Type">
        <Select
          value={data.arrowType ?? "arrow"} disabled={readOnly}
          onChange={(v) => set("arrowType", v as NetworkDiagramEdgeData["arrowType"])}
          options={["none", "arrow", "arrow-both", "circle", "diamond"].map((v) => ({ label: v, value: v }))}
        />
      </Field>

      <SectionTitle>Notes</SectionTitle>
      <Field label="Notes">
        <TextArea value={data.notes ?? ""} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} />
      </Field>
    </div>
  );
}

export function PropertiesPanel() {
  const selectedNodeIds = useDesignerStore((s) => s.selectedNodeIds);
  const selectedEdgeIds = useDesignerStore((s) => s.selectedEdgeIds);

  const singleNode = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const singleEdge = selectedEdgeIds.length === 1 ? selectedEdgeIds[0] : null;

  return (
    <div
      style={{
        width: 300, flexShrink: 0, borderLeft: "1px solid var(--border)", background: "var(--surface)",
        height: "100%", overflowY: "auto", padding: "0.9rem",
      }}
    >
      {singleNode && <DevicePropertiesForm nodeId={singleNode} />}
      {singleEdge && <ConnectionPropertiesForm edgeId={singleEdge} />}
      {!singleNode && !singleEdge && (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)", textAlign: "center", marginTop: "2rem" }}>
          {selectedNodeIds.length > 1
            ? `${selectedNodeIds.length} devices selected`
            : "Select a device or connection to edit its properties."}
        </p>
      )}
    </div>
  );
}

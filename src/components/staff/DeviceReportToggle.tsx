"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
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
  DeviceAlertRow,
  UsbEventRow,
} from "@/components/endpointAgents/DeviceDetail";

interface LatestMetrics {
  cpuPct: number | null;
  memPct: number | null;
  diskPct: number | null;
}

// Lets an employee's own page show their PC's full report inline (System Performance,
// hardware, disk health/SMART, security, etc.) instead of sending the admin to a separate
// Endpoint Agents page to see it - collapsed by default since it's a lot of detail most
// visits to this page won't need.
export function DeviceReportToggle({
  latestMetrics,
  hardware,
  disks,
  diskSpace,
  volumes,
  security,
  network,
  processes,
  services,
  software,
  alerts,
  usbEvents,
}: {
  latestMetrics: LatestMetrics | null;
  hardware: HardwareInfo | null;
  disks: DiskRow[];
  diskSpace: DiskSpace | null;
  volumes: VolumeRow[];
  security: SecurityStatus | null;
  network: NetworkInfo | null;
  processes: ProcessRow[];
  services: ServiceRow[];
  software: SoftwareRow[];
  alerts: DeviceAlertRow[];
  usbEvents: UsbEventRow[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      {latestMetrics && (
        <div className="flex flex-wrap gap-4" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>CPU</span> {latestMetrics.cpuPct != null ? `${latestMetrics.cpuPct.toFixed(0)}%` : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>RAM</span> {latestMetrics.memPct != null ? `${latestMetrics.memPct.toFixed(0)}%` : "-"}
          </span>
          <span>
            <span style={{ color: "var(--ink-muted)" }}>Disk</span> {latestMetrics.diskPct != null ? `${latestMetrics.diskPct.toFixed(0)}%` : "-"}
          </span>
        </div>
      )}

      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: "0.3rem", background: "none", border: "none",
          color: "var(--series-1)", cursor: "pointer", fontSize: "0.85rem", padding: 0,
        }}
      >
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        {expanded ? "Show less" : "Show more"}
      </button>

      {expanded && (
        <div style={{ marginTop: "0.75rem" }}>
          <DeviceDetailExtras
            hardware={hardware}
            disks={disks}
            diskSpace={diskSpace}
            volumes={volumes}
            security={security}
            network={network}
            processes={processes}
            services={services}
            software={software}
            alerts={alerts}
            usbEvents={usbEvents}
          />
        </div>
      )}
    </div>
  );
}

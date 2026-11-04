import { getDb } from "./db";
import { getStaffWithStatus } from "./staffStatus";
import { getAlertHistory } from "./alerts";
import { listSoftware } from "./itAssetLogsheet/repository";
import { getTopBandwidthStaff } from "./topConsumers";

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportSourceDef {
  key: string;
  label: string;
  description: string;
  columns: ReportColumn[];
  usesDays: boolean; // whether this source's fetch() takes a days parameter
}

// A small, fixed registry of report sources, each backed by an already-existing, already-used
// data function - deliberately NOT a generic "pick any table/column" query builder. That would
// mean either building a new dynamic-SQL layer (a real injection/authorization risk surface) or
// trusting user-supplied column names in a query string. Reusing proven functions means the
// only new code here is column *display* selection, which happens entirely client-side over
// data these functions already return - nothing new talks to the database in an unreviewed way.
export const REPORT_SOURCES: ReportSourceDef[] = [
  {
    key: "staff",
    label: "Staff",
    description: "Every employee, their device type, and current online status.",
    usesDays: false,
    columns: [
      { key: "Name", label: "Name" },
      { key: "deviceType", label: "Device Type" },
      { key: "isOnline", label: "Online" },
      { key: "currentIp", label: "Current IP" },
      { key: "MacAddress", label: "MAC Address" },
      { key: "os", label: "OS" },
    ],
  },
  {
    key: "alertHistory",
    label: "Alert History",
    description: "Every alert that has popped the notification bell in the selected window.",
    usesDays: true,
    columns: [
      { key: "Severity", label: "Severity" },
      { key: "Detail", label: "Detail" },
      { key: "Ip", label: "IP" },
      { key: "EventTime", label: "When" },
    ],
  },
  {
    key: "softwareInventory",
    label: "Software Inventory",
    description: "Installed software across every IT asset, with licence seats and expiry.",
    usesDays: false,
    columns: [
      { key: "assetTag", label: "Asset" },
      { key: "softwareName", label: "Software" },
      { key: "publisher", label: "Publisher" },
      { key: "installedVersion", label: "Version" },
      { key: "softwareStatus", label: "Status" },
      { key: "numberOfLicences", label: "Seats" },
      { key: "licenceExpiryDate", label: "Licence Expiry" },
    ],
  },
  {
    key: "bandwidthTop",
    label: "Top Bandwidth (Staff)",
    description: "Highest-bandwidth staff over the last 24 hours, combining both firewall sources.",
    usesDays: false,
    columns: [
      { key: "name", label: "Staff" },
      { key: "ipAddresses", label: "IP Addresses" },
      { key: "totalBytes", label: "Bytes Used" },
    ],
  },
  {
    key: "auditLog",
    label: "Admin Audit Log",
    description: "Every admin action recorded site-wide.",
    usesDays: false,
    columns: [
      { key: "Username", label: "User" },
      { key: "Section", label: "Section" },
      { key: "Action", label: "Action" },
      { key: "Details", label: "Details" },
      { key: "IpAddress", label: "IP" },
      { key: "CreatedAt", label: "When" },
    ],
  },
];

export function getReportSource(key: string): ReportSourceDef | undefined {
  return REPORT_SOURCES.find((s) => s.key === key);
}

export async function runReportSource(key: string, days: number): Promise<Record<string, unknown>[]> {
  switch (key) {
    case "staff": {
      const rows = await getStaffWithStatus();
      return rows as unknown as Record<string, unknown>[];
    }
    case "alertHistory": {
      const rows = await getAlertHistory(days, 500);
      return rows as unknown as Record<string, unknown>[];
    }
    case "softwareInventory": {
      const { items } = await listSoftware({ page: 1, pageSize: 500 });
      return items as unknown as Record<string, unknown>[];
    }
    case "bandwidthTop": {
      const rows = await getTopBandwidthStaff(24, 200);
      return rows.map((r) => ({ ...r, ipAddresses: r.ipAddresses.join(", ") }));
    }
    case "auditLog": {
      const db = await getDb();
      const result = await db.query<Record<string, unknown>>(`
        SELECT TOP 500 Username, Section, Action, Details, IpAddress, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
        FROM AdminAuditLog ORDER BY CreatedAt DESC
      `);
      return result.recordset;
    }
    default:
      return [];
  }
}

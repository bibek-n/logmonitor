import { getDb } from "../db";
import type { ExportColumn } from "./exportHelpers";

// The 15 report types map 1:1 onto getDashboardStats()'s 15 categories (repository.ts) - each
// dashboard stat card is a count of exactly the row set its matching report lists in full, so
// the two can never silently drift apart the way two independently-written queries could.
export interface ReportDefinition {
  key: string;
  title: string;
  description: string;
}

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  { key: "active-assets", title: "Active Assets", description: "All assets currently in active service." },
  { key: "servers", title: "Servers", description: "All assets of type Server." },
  { key: "desktops-laptops", title: "Desktops & Laptops", description: "All desktop and laptop assets." },
  { key: "under-maintenance", title: "Assets Under Maintenance", description: "Assets currently marked Under Maintenance." },
  { key: "retired-assets", title: "Retired Assets", description: "Assets that have been retired." },
  { key: "password-overdue", title: "Password Changes Overdue", description: "Password/credential rotations past their due date." },
  { key: "password-due-soon", title: "Password Changes Due Soon", description: "Password/credential rotations due today or soon." },
  { key: "critical-patches-pending", title: "Critical Patches Pending", description: "Critical-severity patches not yet installed." },
  { key: "failed-patches", title: "Failed Patch Installations", description: "Patches that failed to install." },
  { key: "software-updates-required", title: "Software Requiring Updates", description: "Installed software flagged as needing an update." },
  { key: "unsupported-software", title: "Unsupported Software", description: "Installed software that is no longer supported by its vendor." },
  { key: "licences-expiring", title: "Licences Expiring Soon", description: "Software licences expiring within 30 days." },
  { key: "maintenance-due", title: "Maintenance Tasks Due", description: "Planned/scheduled maintenance due within 7 days." },
  { key: "maintenance-overdue", title: "Overdue Maintenance Tasks", description: "Planned/scheduled maintenance past its scheduled date." },
  { key: "assets-not-checked", title: "Assets Not Checked Recently", description: "Assets with no inventory check date, or one already past due." },
];

export interface ReportData {
  columns: ExportColumn[];
  rows: Record<string, string>[];
}

const ASSET_COLUMNS: ExportColumn[] = [
  { header: "Asset Tag", key: "assetTag", width: 16 },
  { header: "Hostname", key: "hostname", width: 18 },
  { header: "Type", key: "assetType", width: 12 },
  { header: "Department", key: "department", width: 16 },
  { header: "Location", key: "location", width: 16 },
  { header: "Assigned User", key: "assignedUser", width: 16 },
  { header: "Status", key: "status", width: 12 },
  { header: "Criticality", key: "criticality", width: 12 },
];

function s(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function mapAssetRows(recordset: Record<string, unknown>[]): Record<string, string>[] {
  return recordset.map((r) => ({
    assetTag: s(r.AssetTag),
    hostname: s(r.Hostname),
    assetType: s(r.AssetType),
    department: s(r.Department),
    location: s(r.Location),
    assignedUser: s(r.AssignedUser),
    status: s(r.Status),
    criticality: s(r.Criticality),
  }));
}

export async function getReportData(key: string): Promise<ReportData | null> {
  const db = await getDb();

  switch (key) {
    case "active-assets": {
      const r = await db.query`SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, Criticality FROM Assets WHERE IsDeleted = 0 AND Status = 'Active' ORDER BY AssetTag`;
      return { columns: ASSET_COLUMNS, rows: mapAssetRows(r.recordset) };
    }
    case "servers": {
      const r = await db.query`SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, Criticality FROM Assets WHERE IsDeleted = 0 AND AssetType = 'Server' ORDER BY AssetTag`;
      return { columns: ASSET_COLUMNS, rows: mapAssetRows(r.recordset) };
    }
    case "desktops-laptops": {
      const r = await db.query`SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, Criticality FROM Assets WHERE IsDeleted = 0 AND AssetType IN ('Desktop','Laptop') ORDER BY AssetTag`;
      return { columns: ASSET_COLUMNS, rows: mapAssetRows(r.recordset) };
    }
    case "under-maintenance": {
      const r = await db.query`SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, Criticality FROM Assets WHERE IsDeleted = 0 AND Status = 'UnderMaintenance' ORDER BY AssetTag`;
      return { columns: ASSET_COLUMNS, rows: mapAssetRows(r.recordset) };
    }
    case "retired-assets": {
      const r = await db.query`SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, Criticality FROM Assets WHERE IsDeleted = 0 AND Status = 'Retired' ORDER BY AssetTag`;
      return { columns: ASSET_COLUMNS, rows: mapAssetRows(r.recordset) };
    }
    case "password-overdue": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, p.AccountOrServiceName, p.AccountType, p.NextPasswordChangeDate, p.Status
        FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId
        WHERE p.IsDeleted = 0 AND p.Status = 'Overdue' ORDER BY p.NextPasswordChangeDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Account/Service", key: "account", width: 22 },
        { header: "Account Type", key: "accountType", width: 16 },
        { header: "Next Change Due", key: "nextChange", width: 16 },
        { header: "Status", key: "status", width: 12 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), account: s(row.AccountOrServiceName),
        accountType: s(row.AccountType), nextChange: s(row.NextPasswordChangeDate), status: s(row.Status),
      }));
      return { columns, rows };
    }
    case "password-due-soon": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, p.AccountOrServiceName, p.AccountType, p.NextPasswordChangeDate, p.Status
        FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId
        WHERE p.IsDeleted = 0 AND p.Status IN ('DueSoon','DueToday') ORDER BY p.NextPasswordChangeDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Account/Service", key: "account", width: 22 },
        { header: "Account Type", key: "accountType", width: 16 },
        { header: "Next Change Due", key: "nextChange", width: 16 },
        { header: "Status", key: "status", width: 12 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), account: s(row.AccountOrServiceName),
        accountType: s(row.AccountType), nextChange: s(row.NextPasswordChangeDate), status: s(row.Status),
      }));
      return { columns, rows };
    }
    case "critical-patches-pending": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, p.PatchName, p.Severity, p.InstallationStatus, p.ScheduledInstallationDate
        FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId
        WHERE p.IsDeleted = 0 AND p.Severity = 'Critical' AND p.InstallationStatus IN ('Planned','Scheduled','InProgress')
        ORDER BY p.ScheduledInstallationDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Patch", key: "patch", width: 24 },
        { header: "Severity", key: "severity", width: 12 },
        { header: "Status", key: "status", width: 14 },
        { header: "Scheduled", key: "scheduled", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), patch: s(row.PatchName),
        severity: s(row.Severity), status: s(row.InstallationStatus), scheduled: s(row.ScheduledInstallationDate),
      }));
      return { columns, rows };
    }
    case "failed-patches": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, p.PatchName, p.Severity, p.FailureReason, p.ActualInstallationDate
        FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId
        WHERE p.IsDeleted = 0 AND p.InstallationStatus = 'Failed' ORDER BY p.ActualInstallationDate DESC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Patch", key: "patch", width: 24 },
        { header: "Severity", key: "severity", width: 12 },
        { header: "Failure Reason", key: "reason", width: 30 },
        { header: "Attempted", key: "attempted", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), patch: s(row.PatchName),
        severity: s(row.Severity), reason: s(row.FailureReason), attempted: s(row.ActualInstallationDate),
      }));
      return { columns, rows };
    }
    case "software-updates-required": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, sw.SoftwareName, sw.InstalledVersion, sw.LatestApprovedVersion, sw.SoftwareStatus
        FROM SoftwareInventory sw JOIN Assets a ON a.Id = sw.AssetId
        WHERE sw.IsDeleted = 0 AND sw.SoftwareStatus = 'UpdateRequired' ORDER BY a.AssetTag
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Software", key: "software", width: 22 },
        { header: "Installed Version", key: "installed", width: 16 },
        { header: "Latest Approved", key: "latest", width: 16 },
        { header: "Status", key: "status", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), software: s(row.SoftwareName),
        installed: s(row.InstalledVersion), latest: s(row.LatestApprovedVersion), status: s(row.SoftwareStatus),
      }));
      return { columns, rows };
    }
    case "unsupported-software": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, sw.SoftwareName, sw.Publisher, sw.InstalledVersion, sw.SoftwareStatus
        FROM SoftwareInventory sw JOIN Assets a ON a.Id = sw.AssetId
        WHERE sw.IsDeleted = 0 AND sw.SoftwareStatus = 'Unsupported' ORDER BY a.AssetTag
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Software", key: "software", width: 22 },
        { header: "Publisher", key: "publisher", width: 18 },
        { header: "Installed Version", key: "installed", width: 16 },
        { header: "Status", key: "status", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), software: s(row.SoftwareName),
        publisher: s(row.Publisher), installed: s(row.InstalledVersion), status: s(row.SoftwareStatus),
      }));
      return { columns, rows };
    }
    case "licences-expiring": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, sw.SoftwareName, sw.LicenceType, sw.LicenceExpiryDate, sw.NumberOfLicences
        FROM SoftwareInventory sw JOIN Assets a ON a.Id = sw.AssetId
        WHERE sw.IsDeleted = 0 AND sw.LicenceExpiryDate IS NOT NULL AND sw.LicenceExpiryDate <= DATEADD(DAY, 30, SYSUTCDATETIME())
        ORDER BY sw.LicenceExpiryDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Software", key: "software", width: 22 },
        { header: "Licence Type", key: "licenceType", width: 16 },
        { header: "Expiry Date", key: "expiry", width: 14 },
        { header: "Licences", key: "count", width: 10 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), software: s(row.SoftwareName),
        licenceType: s(row.LicenceType), expiry: s(row.LicenceExpiryDate), count: s(row.NumberOfLicences),
      }));
      return { columns, rows };
    }
    case "maintenance-due": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, m.ActivityTitle, m.ActivityType, m.Priority, m.ScheduledDate, m.Status
        FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId
        WHERE m.IsDeleted = 0 AND m.Status IN ('Planned','Scheduled') AND m.ScheduledDate <= DATEADD(DAY, 7, SYSUTCDATETIME())
        ORDER BY m.ScheduledDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Activity", key: "activity", width: 22 },
        { header: "Type", key: "type", width: 16 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Scheduled", key: "scheduled", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), activity: s(row.ActivityTitle),
        type: s(row.ActivityType), priority: s(row.Priority), scheduled: s(row.ScheduledDate),
      }));
      return { columns, rows };
    }
    case "maintenance-overdue": {
      const r = await db.query`
        SELECT a.AssetTag, a.Hostname, m.ActivityTitle, m.ActivityType, m.Priority, m.ScheduledDate, m.Status
        FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId
        WHERE m.IsDeleted = 0 AND m.Status IN ('Planned','Scheduled') AND m.ScheduledDate < CAST(SYSUTCDATETIME() AS DATE)
        ORDER BY m.ScheduledDate ASC
      `;
      const columns: ExportColumn[] = [
        { header: "Asset Tag", key: "assetTag", width: 16 },
        { header: "Hostname", key: "hostname", width: 18 },
        { header: "Activity", key: "activity", width: 22 },
        { header: "Type", key: "type", width: 16 },
        { header: "Priority", key: "priority", width: 12 },
        { header: "Scheduled", key: "scheduled", width: 14 },
      ];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        assetTag: s(row.AssetTag), hostname: s(row.Hostname), activity: s(row.ActivityTitle),
        type: s(row.ActivityType), priority: s(row.Priority), scheduled: s(row.ScheduledDate),
      }));
      return { columns, rows };
    }
    case "assets-not-checked": {
      const r = await db.query`
        SELECT AssetTag, Hostname, AssetType, Department, Location, AssignedUser, Status, NextInventoryCheckDate
        FROM Assets WHERE IsDeleted = 0 AND (NextInventoryCheckDate IS NULL OR NextInventoryCheckDate < CAST(SYSUTCDATETIME() AS DATE))
        ORDER BY AssetTag
      `;
      const columns: ExportColumn[] = [...ASSET_COLUMNS, { header: "Next Check Due", key: "nextCheck", width: 16 }];
      const rows = r.recordset.map((row: Record<string, unknown>) => ({
        ...mapAssetRows([row])[0],
        nextCheck: s(row.NextInventoryCheckDate) || "Never checked",
      }));
      return { columns, rows };
    }
    default:
      return null;
  }
}

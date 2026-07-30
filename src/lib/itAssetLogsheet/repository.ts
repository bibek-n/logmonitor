import { getDb, sql } from "../db";
import {
  Asset,
  PasswordChangeLog,
  PasswordStatus,
  PatchUpdateLog,
  SoftwareInventoryItem,
  MaintenanceLog,
  AssetAttachment,
  ItAssetSettings,
} from "./types";

// --- Status calculation ----------------------------------------------------------------------

// Pure function, no DB/clock dependency beyond `now` - called both when a row is written (so
// Status is correct immediately) and by the daily refresh job (scripts/run-it-asset-status-
// refresh.ts) to catch pure calendar-time transitions (e.g. DueSoon -> Overdue) that happen
// without anyone editing the record. Mirrors the exact pattern already used for Remote Access's
// credential-rotation due-date calculation this session.
export function computePasswordStatus(
  lastChangeDate: string | null,
  rotationIntervalDays: number | null,
  dueSoonDays: number,
  now: Date = new Date()
): { status: PasswordStatus; nextChangeDate: string | null } {
  if (!lastChangeDate || !rotationIntervalDays) {
    return { status: "NotConfigured", nextChangeDate: null };
  }
  const last = new Date(lastChangeDate + "T00:00:00Z");
  const next = new Date(last);
  next.setUTCDate(next.getUTCDate() + rotationIntervalDays);
  const nextChangeDate = next.toISOString().slice(0, 10);

  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const daysUntilDue = Math.round((next.getTime() - todayUtc.getTime()) / 86400000);

  let status: PasswordStatus;
  if (daysUntilDue < 0) status = "Overdue";
  else if (daysUntilDue === 0) status = "DueToday";
  else if (daysUntilDue <= dueSoonDays) status = "DueSoon";
  else status = "Current";

  return { status, nextChangeDate };
}

// --- Settings (singleton) ---------------------------------------------------------------------

function mapSettings(r: {
  PasswordDueSoonDays: number;
  PatchDueSoonDays: number;
  MaintenanceDueSoonDays: number;
  WarrantyExpiryWarningDays: number;
  LicenceExpiryWarningDays: number;
  InventoryCheckIntervalDays: number;
  NotificationRecipientsJson: string | null;
  NotificationFrequency: "Immediate" | "Daily" | "Weekly";
  EscalationRecipientsJson: string | null;
  EscalationAfterDays: number | null;
  CriticalAssetsAlertImmediately: boolean;
  EmailAlertsEnabled: boolean;
}): ItAssetSettings {
  return {
    passwordDueSoonDays: r.PasswordDueSoonDays,
    patchDueSoonDays: r.PatchDueSoonDays,
    maintenanceDueSoonDays: r.MaintenanceDueSoonDays,
    warrantyExpiryWarningDays: r.WarrantyExpiryWarningDays,
    licenceExpiryWarningDays: r.LicenceExpiryWarningDays,
    inventoryCheckIntervalDays: r.InventoryCheckIntervalDays,
    notificationRecipients: r.NotificationRecipientsJson ? JSON.parse(r.NotificationRecipientsJson) : [],
    notificationFrequency: r.NotificationFrequency,
    escalationRecipients: r.EscalationRecipientsJson ? JSON.parse(r.EscalationRecipientsJson) : [],
    escalationAfterDays: r.EscalationAfterDays,
    criticalAssetsAlertImmediately: r.CriticalAssetsAlertImmediately,
    emailAlertsEnabled: r.EmailAlertsEnabled,
  };
}

export async function getItAssetSettings(): Promise<ItAssetSettings> {
  const db = await getDb();
  const result = await db.query`SELECT * FROM ItAssetSettings WHERE Id = 1`;
  return mapSettings(result.recordset[0]);
}

export async function updateItAssetSettings(patch: Partial<ItAssetSettings>, updatedByUserId: number): Promise<void> {
  const db = await getDb();
  const current = await getItAssetSettings();
  const merged = { ...current, ...patch };
  await db
    .request()
    .input("passwordDueSoonDays", sql.Int, merged.passwordDueSoonDays)
    .input("patchDueSoonDays", sql.Int, merged.patchDueSoonDays)
    .input("maintenanceDueSoonDays", sql.Int, merged.maintenanceDueSoonDays)
    .input("warrantyExpiryWarningDays", sql.Int, merged.warrantyExpiryWarningDays)
    .input("licenceExpiryWarningDays", sql.Int, merged.licenceExpiryWarningDays)
    .input("inventoryCheckIntervalDays", sql.Int, merged.inventoryCheckIntervalDays)
    .input("notificationRecipientsJson", sql.NVarChar, JSON.stringify(merged.notificationRecipients ?? []))
    .input("notificationFrequency", sql.VarChar, merged.notificationFrequency)
    .input("escalationRecipientsJson", sql.NVarChar, JSON.stringify(merged.escalationRecipients ?? []))
    .input("escalationAfterDays", sql.Int, merged.escalationAfterDays)
    .input("criticalAssetsAlertImmediately", sql.Bit, merged.criticalAssetsAlertImmediately)
    .input("emailAlertsEnabled", sql.Bit, merged.emailAlertsEnabled)
    .input("updatedByUserId", sql.Int, updatedByUserId)
    .query(`
      UPDATE ItAssetSettings SET
        PasswordDueSoonDays = @passwordDueSoonDays, PatchDueSoonDays = @patchDueSoonDays,
        MaintenanceDueSoonDays = @maintenanceDueSoonDays, WarrantyExpiryWarningDays = @warrantyExpiryWarningDays,
        LicenceExpiryWarningDays = @licenceExpiryWarningDays, InventoryCheckIntervalDays = @inventoryCheckIntervalDays,
        NotificationRecipientsJson = @notificationRecipientsJson, NotificationFrequency = @notificationFrequency,
        EscalationRecipientsJson = @escalationRecipientsJson, EscalationAfterDays = @escalationAfterDays,
        CriticalAssetsAlertImmediately = @criticalAssetsAlertImmediately, EmailAlertsEnabled = @emailAlertsEnabled,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);
}

// --- Assets ------------------------------------------------------------------------------------

function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: r.Id as number,
    assetTag: r.AssetTag as string,
    hostname: r.Hostname as string | null,
    deviceName: r.DeviceName as string | null,
    assetType: r.AssetType as Asset["assetType"],
    deviceCategory: r.DeviceCategory as string | null,
    manufacturer: r.Manufacturer as string | null,
    model: r.Model as string | null,
    serialNumber: r.SerialNumber as string | null,
    operatingSystem: r.OperatingSystem as string | null,
    osVersion: r.OsVersion as string | null,
    ipAddress: r.IpAddress as string | null,
    macAddress: r.MacAddress as string | null,
    domainOrWorkgroup: r.DomainOrWorkgroup as string | null,
    isVirtual: r.IsVirtual as boolean,
    department: r.Department as string | null,
    location: r.Location as string | null,
    assignedUser: r.AssignedUser as string | null,
    assetOwner: r.AssetOwner as string | null,
    responsibleTechnician: r.ResponsibleTechnician as string | null,
    purchaseDate: formatDate(r.PurchaseDate as Date | null),
    warrantyExpiryDate: formatDate(r.WarrantyExpiryDate as Date | null),
    installationDate: formatDate(r.InstallationDate as Date | null),
    status: r.Status as Asset["status"],
    criticality: r.Criticality as Asset["criticality"],
    environment: r.Environment as string | null,
    lastInventoryCheckDate: formatDate(r.LastInventoryCheckDate as Date | null),
    nextInventoryCheckDate: formatDate(r.NextInventoryCheckDate as Date | null),
    notes: r.Notes as string | null,
    linkedDeviceId: r.LinkedDeviceId as number | null,
    linkedStaffId: r.LinkedStaffId as number | null,
    createdAt: r.CreatedAt as Date,
    createdByUserId: r.CreatedByUserId as number | null,
    createdByUsername: r.CreatedByUsername as string | null,
    updatedAt: r.UpdatedAt as Date,
    updatedByUserId: r.UpdatedByUserId as number | null,
    updatedByUsername: r.UpdatedByUsername as string | null,
  };
}

function formatDate(d: Date | null): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null;
}

export interface AssetFilter {
  search?: string;
  assetType?: string;
  status?: string;
  criticality?: string;
  department?: string;
  location?: string;
  assignedUser?: string;
  technician?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "ASC" | "DESC";
}

const ASSET_SORT_COLUMNS = new Set([
  "AssetTag", "Hostname", "AssetType", "Status", "Criticality", "Department", "Location", "CreatedAt", "UpdatedAt",
]);

export async function listAssets(filter: AssetFilter): Promise<{ assets: Asset[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const sortBy = ASSET_SORT_COLUMNS.has(filter.sortBy ?? "") ? filter.sortBy! : "AssetTag";
  const sortDir = filter.sortDir === "DESC" ? "DESC" : "ASC";

  const req = db
    .request()
    .input("search", sql.NVarChar, filter.search ? `%${filter.search}%` : null)
    .input("assetType", sql.VarChar, filter.assetType ?? null)
    .input("status", sql.VarChar, filter.status ?? null)
    .input("criticality", sql.VarChar, filter.criticality ?? null)
    .input("department", sql.NVarChar, filter.department ?? null)
    .input("location", sql.NVarChar, filter.location ?? null)
    .input("assignedUser", sql.NVarChar, filter.assignedUser ?? null)
    .input("technician", sql.NVarChar, filter.technician ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);

  const where = `
    WHERE IsDeleted = 0
      AND (@search IS NULL OR AssetTag LIKE @search OR Hostname LIKE @search OR SerialNumber LIKE @search OR IpAddress LIKE @search OR DeviceName LIKE @search)
      AND (@assetType IS NULL OR AssetType = @assetType)
      AND (@status IS NULL OR Status = @status)
      AND (@criticality IS NULL OR Criticality = @criticality)
      AND (@department IS NULL OR Department = @department)
      AND (@location IS NULL OR Location = @location)
      AND (@assignedUser IS NULL OR AssignedUser = @assignedUser)
      AND (@technician IS NULL OR ResponsibleTechnician = @technician)
  `;

  const [rows, count] = await Promise.all([
    req.query(`SELECT * FROM Assets ${where} ORDER BY ${sortBy} ${sortDir} OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`),
    req.query(`SELECT COUNT(*) AS Total FROM Assets ${where}`),
  ]);

  return { assets: rows.recordset.map(mapAsset), total: count.recordset[0].Total as number };
}

export async function getAssetById(id: number): Promise<Asset | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`SELECT * FROM Assets WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset[0] ? mapAsset(result.recordset[0]) : null;
}

export async function findAssetDuplicates(fields: {
  assetTag?: string;
  serialNumber?: string;
  hostname?: string;
  ipAddress?: string;
  excludeId?: number;
}): Promise<Asset[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetTag", sql.NVarChar, fields.assetTag ?? null)
    .input("serialNumber", sql.NVarChar, fields.serialNumber ?? null)
    .input("hostname", sql.NVarChar, fields.hostname ?? null)
    .input("ipAddress", sql.NVarChar, fields.ipAddress ?? null)
    .input("excludeId", sql.Int, fields.excludeId ?? null)
    .query(`
      SELECT * FROM Assets
      WHERE IsDeleted = 0 AND (@excludeId IS NULL OR Id <> @excludeId)
        AND (
          (@assetTag IS NOT NULL AND AssetTag = @assetTag) OR
          (@serialNumber IS NOT NULL AND SerialNumber = @serialNumber) OR
          (@hostname IS NOT NULL AND Hostname = @hostname) OR
          (@ipAddress IS NOT NULL AND IpAddress = @ipAddress)
        )
    `);
  return result.recordset.map(mapAsset);
}

const ASSET_INSERT_COLUMNS = [
  "assetTag", "hostname", "deviceName", "assetType", "deviceCategory", "manufacturer", "model", "serialNumber",
  "operatingSystem", "osVersion", "ipAddress", "macAddress", "domainOrWorkgroup", "isVirtual", "department",
  "location", "assignedUser", "assetOwner", "responsibleTechnician", "purchaseDate", "warrantyExpiryDate",
  "installationDate", "status", "criticality", "environment", "lastInventoryCheckDate", "nextInventoryCheckDate",
  "notes", "linkedDeviceId", "linkedStaffId",
] as const;

const ASSET_COLUMN_TYPES: Record<(typeof ASSET_INSERT_COLUMNS)[number], unknown> = {
  assetTag: sql.NVarChar, hostname: sql.NVarChar, deviceName: sql.NVarChar, assetType: sql.VarChar,
  deviceCategory: sql.NVarChar, manufacturer: sql.NVarChar, model: sql.NVarChar, serialNumber: sql.NVarChar,
  operatingSystem: sql.NVarChar, osVersion: sql.NVarChar, ipAddress: sql.VarChar, macAddress: sql.VarChar,
  domainOrWorkgroup: sql.NVarChar, isVirtual: sql.Bit, department: sql.NVarChar, location: sql.NVarChar,
  assignedUser: sql.NVarChar, assetOwner: sql.NVarChar, responsibleTechnician: sql.NVarChar, purchaseDate: sql.Date,
  warrantyExpiryDate: sql.Date, installationDate: sql.Date, status: sql.VarChar, criticality: sql.VarChar,
  environment: sql.NVarChar, lastInventoryCheckDate: sql.Date, nextInventoryCheckDate: sql.Date, notes: sql.NVarChar,
  linkedDeviceId: sql.Int, linkedStaffId: sql.Int,
};

export async function createAsset(
  data: Partial<Record<(typeof ASSET_INSERT_COLUMNS)[number], unknown>>,
  actor: { userId: number; username: string }
): Promise<number> {
  const db = await getDb();
  const req = db.request();
  for (const col of ASSET_INSERT_COLUMNS) {
    req.input(col, ASSET_COLUMN_TYPES[col] as never, data[col] ?? null);
  }
  req.input("createdByUserId", sql.Int, actor.userId).input("createdByUsername", sql.NVarChar, actor.username);

  const cols = ASSET_INSERT_COLUMNS.map(
    (c) => c.charAt(0).toUpperCase() + c.slice(1)
  );
  const result = await req.query<{ Id: number }>(`
    INSERT INTO Assets (${cols.join(", ")}, CreatedByUserId, CreatedByUsername, UpdatedByUserId, UpdatedByUsername)
    OUTPUT INSERTED.Id
    VALUES (${ASSET_INSERT_COLUMNS.map((c) => `@${c}`).join(", ")}, @createdByUserId, @createdByUsername, @createdByUserId, @createdByUsername)
  `);
  return result.recordset[0].Id;
}

export async function updateAsset(
  id: number,
  data: Partial<Record<(typeof ASSET_INSERT_COLUMNS)[number], unknown>>,
  actor: { userId: number; username: string }
): Promise<void> {
  const db = await getDb();
  const req = db.request().input("id", sql.Int, id);
  const setClauses: string[] = [];
  for (const col of ASSET_INSERT_COLUMNS) {
    if (!(col in data)) continue;
    req.input(col, ASSET_COLUMN_TYPES[col] as never, data[col] ?? null);
    setClauses.push(`${col.charAt(0).toUpperCase() + col.slice(1)} = @${col}`);
  }
  if (setClauses.length === 0) return;
  req.input("updatedByUserId", sql.Int, actor.userId).input("updatedByUsername", sql.NVarChar, actor.username);
  await req.query(`
    UPDATE Assets SET ${setClauses.join(", ")}, UpdatedAt = SYSUTCDATETIME(),
      UpdatedByUserId = @updatedByUserId, UpdatedByUsername = @updatedByUsername
    WHERE Id = @id AND IsDeleted = 0
  `);
}

// Soft delete only, per spec section 15 ("Use soft deletion instead of permanent deletion for
// operational records") - the row and every linked log row remain queryable via audit history,
// just excluded from normal list/detail views.
export async function softDeleteAsset(id: number, deletedByUserId: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("deletedByUserId", sql.Int, deletedByUserId)
    .query(`UPDATE Assets SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedByUserId = @deletedByUserId WHERE Id = @id`);
}

export async function reactivateAsset(id: number, actor: { userId: number; username: string }): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("userId", sql.Int, actor.userId)
    .input("username", sql.NVarChar, actor.username)
    .query(`UPDATE Assets SET Status = 'Active', UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @userId, UpdatedByUsername = @username WHERE Id = @id AND IsDeleted = 0`);
}

// --- Password Change Logs ----------------------------------------------------------------------

function mapPasswordLog(r: Record<string, unknown>): PasswordChangeLog {
  return {
    id: r.Id as number,
    assetId: r.AssetId as number,
    accountOrServiceName: r.AccountOrServiceName as string,
    accountType: r.AccountType as PasswordChangeLog["accountType"],
    usernameOrAccountId: r.UsernameOrAccountId as string | null,
    credentialLocationRef: r.CredentialLocationRef as string | null,
    lastPasswordChangeDate: formatDate(r.LastPasswordChangeDate as Date | null),
    rotationIntervalDays: r.RotationIntervalDays as number | null,
    nextPasswordChangeDate: formatDate(r.NextPasswordChangeDate as Date | null),
    status: r.Status as PasswordStatus,
    changedBy: r.ChangedBy as string | null,
    approvedBy: r.ApprovedBy as string | null,
    verificationStatus: r.VerificationStatus as PasswordChangeLog["verificationStatus"],
    verificationDate: formatDate(r.VerificationDate as Date | null),
    reasonForChange: r.ReasonForChange as string | null,
    changeRequestNumber: r.ChangeRequestNumber as string | null,
    notes: r.Notes as string | null,
    createdAt: r.CreatedAt as Date,
    createdByUserId: r.CreatedByUserId as number | null,
    createdByUsername: r.CreatedByUsername as string | null,
    updatedAt: r.UpdatedAt as Date,
    updatedByUserId: r.UpdatedByUserId as number | null,
    updatedByUsername: r.UpdatedByUsername as string | null,
  };
}

export async function listPasswordLogsForAsset(assetId: number): Promise<PasswordChangeLog[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .query(`SELECT * FROM PasswordChangeLogs WHERE AssetId = @assetId AND IsDeleted = 0 ORDER BY LastPasswordChangeDate DESC`);
  return result.recordset.map(mapPasswordLog);
}

export interface PasswordLogFilter {
  status?: string;
  accountType?: string;
  page?: number;
  pageSize?: number;
}

export async function listPasswordLogs(filter: PasswordLogFilter): Promise<{ logs: (PasswordChangeLog & { assetTag: string; hostname: string | null })[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const req = db
    .request()
    .input("status", sql.VarChar, filter.status ?? null)
    .input("accountType", sql.VarChar, filter.accountType ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);

  const where = `
    WHERE p.IsDeleted = 0 AND a.IsDeleted = 0
      AND (@status IS NULL OR p.Status = @status)
      AND (@accountType IS NULL OR p.AccountType = @accountType)
  `;
  const [rows, count] = await Promise.all([
    req.query(`
      SELECT p.*, a.AssetTag, a.Hostname FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId
      ${where} ORDER BY p.NextPasswordChangeDate ASC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query(`SELECT COUNT(*) AS Total FROM PasswordChangeLogs p JOIN Assets a ON a.Id = p.AssetId ${where}`),
  ]);

  return {
    logs: rows.recordset.map((r: Record<string, unknown>) => ({ ...mapPasswordLog(r), assetTag: r.AssetTag as string, hostname: r.Hostname as string | null })),
    total: count.recordset[0].Total as number,
  };
}

export async function createPasswordLog(
  assetId: number,
  data: Record<string, unknown>,
  actor: { userId: number; username: string },
  dueSoonDays: number
): Promise<number> {
  const db = await getDb();
  const { status, nextChangeDate } = computePasswordStatus(
    (data.lastPasswordChangeDate as string) ?? null,
    (data.rotationIntervalDays as number) ?? null,
    dueSoonDays
  );
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .input("accountOrServiceName", sql.NVarChar, data.accountOrServiceName)
    .input("accountType", sql.VarChar, data.accountType)
    .input("usernameOrAccountId", sql.NVarChar, data.usernameOrAccountId ?? null)
    .input("credentialLocationRef", sql.NVarChar, data.credentialLocationRef ?? null)
    .input("lastPasswordChangeDate", sql.Date, data.lastPasswordChangeDate ?? null)
    .input("rotationIntervalDays", sql.Int, data.rotationIntervalDays ?? null)
    .input("nextPasswordChangeDate", sql.Date, nextChangeDate)
    .input("status", sql.VarChar, status)
    .input("changedBy", sql.NVarChar, data.changedBy ?? null)
    .input("approvedBy", sql.NVarChar, data.approvedBy ?? null)
    .input("verificationStatus", sql.VarChar, data.verificationStatus ?? null)
    .input("verificationDate", sql.Date, data.verificationDate ?? null)
    .input("reasonForChange", sql.NVarChar, data.reasonForChange ?? null)
    .input("changeRequestNumber", sql.NVarChar, data.changeRequestNumber ?? null)
    .input("notes", sql.NVarChar, data.notes ?? null)
    .input("createdByUserId", sql.Int, actor.userId)
    .input("createdByUsername", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO PasswordChangeLogs (
        AssetId, AccountOrServiceName, AccountType, UsernameOrAccountId, CredentialLocationRef,
        LastPasswordChangeDate, RotationIntervalDays, NextPasswordChangeDate, Status, ChangedBy, ApprovedBy,
        VerificationStatus, VerificationDate, ReasonForChange, ChangeRequestNumber, Notes,
        CreatedByUserId, CreatedByUsername, UpdatedByUserId, UpdatedByUsername
      )
      OUTPUT INSERTED.Id
      VALUES (
        @assetId, @accountOrServiceName, @accountType, @usernameOrAccountId, @credentialLocationRef,
        @lastPasswordChangeDate, @rotationIntervalDays, @nextPasswordChangeDate, @status, @changedBy, @approvedBy,
        @verificationStatus, @verificationDate, @reasonForChange, @changeRequestNumber, @notes,
        @createdByUserId, @createdByUsername, @createdByUserId, @createdByUsername
      )
    `);
  return result.recordset[0].Id;
}

export async function updatePasswordLog(
  id: number,
  data: Record<string, unknown>,
  actor: { userId: number; username: string },
  dueSoonDays: number
): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query(`SELECT * FROM PasswordChangeLogs WHERE Id = @id AND IsDeleted = 0`);
  const row = existing.recordset[0];
  if (!row) return;
  const merged = { ...row, ...data };
  const lastChange: string | null =
    data.lastPasswordChangeDate !== undefined ? (data.lastPasswordChangeDate as string | null) : formatDate(row.LastPasswordChangeDate);
  const interval: number | null =
    data.rotationIntervalDays !== undefined ? (data.rotationIntervalDays as number | null) : row.RotationIntervalDays;
  const { status, nextChangeDate } = computePasswordStatus(lastChange, interval, dueSoonDays);

  await db
    .request()
    .input("id", sql.Int, id)
    .input("accountOrServiceName", sql.NVarChar, merged.AccountOrServiceName ?? merged.accountOrServiceName)
    .input("accountType", sql.VarChar, merged.AccountType ?? merged.accountType)
    .input("usernameOrAccountId", sql.NVarChar, data.usernameOrAccountId ?? row.UsernameOrAccountId)
    .input("credentialLocationRef", sql.NVarChar, data.credentialLocationRef ?? row.CredentialLocationRef)
    .input("lastPasswordChangeDate", sql.Date, lastChange)
    .input("rotationIntervalDays", sql.Int, interval)
    .input("nextPasswordChangeDate", sql.Date, nextChangeDate)
    .input("status", sql.VarChar, status)
    .input("changedBy", sql.NVarChar, data.changedBy ?? row.ChangedBy)
    .input("approvedBy", sql.NVarChar, data.approvedBy ?? row.ApprovedBy)
    .input("verificationStatus", sql.VarChar, data.verificationStatus ?? row.VerificationStatus)
    .input("verificationDate", sql.Date, data.verificationDate ?? row.VerificationDate)
    .input("reasonForChange", sql.NVarChar, data.reasonForChange ?? row.ReasonForChange)
    .input("changeRequestNumber", sql.NVarChar, data.changeRequestNumber ?? row.ChangeRequestNumber)
    .input("notes", sql.NVarChar, data.notes ?? row.Notes)
    .input("updatedByUserId", sql.Int, actor.userId)
    .input("updatedByUsername", sql.NVarChar, actor.username)
    .query(`
      UPDATE PasswordChangeLogs SET
        AccountOrServiceName = @accountOrServiceName, AccountType = @accountType,
        UsernameOrAccountId = @usernameOrAccountId, CredentialLocationRef = @credentialLocationRef,
        LastPasswordChangeDate = @lastPasswordChangeDate, RotationIntervalDays = @rotationIntervalDays,
        NextPasswordChangeDate = @nextPasswordChangeDate, Status = @status, ChangedBy = @changedBy,
        ApprovedBy = @approvedBy, VerificationStatus = @verificationStatus, VerificationDate = @verificationDate,
        ReasonForChange = @reasonForChange, ChangeRequestNumber = @changeRequestNumber, Notes = @notes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId, UpdatedByUsername = @updatedByUsername
      WHERE Id = @id
    `);
}

// Recomputes Status/NextPasswordChangeDate for every non-deleted row - run daily by
// scripts/run-it-asset-status-refresh.ts so DueSoon/Overdue transitions happen even for records
// nobody has edited recently. Pure SQL (no per-row JS round trip) since the calculation only
// needs LastPasswordChangeDate + RotationIntervalDays + the configured due-soon threshold.
export async function refreshPasswordLogStatuses(dueSoonDays: number): Promise<number> {
  const db = await getDb();
  const result = await db.request().input("dueSoonDays", sql.Int, dueSoonDays).query(`
    UPDATE PasswordChangeLogs SET
      NextPasswordChangeDate = DATEADD(DAY, RotationIntervalDays, LastPasswordChangeDate),
      Status = CASE
        WHEN LastPasswordChangeDate IS NULL OR RotationIntervalDays IS NULL THEN 'NotConfigured'
        WHEN DATEADD(DAY, RotationIntervalDays, LastPasswordChangeDate) < CAST(SYSUTCDATETIME() AS DATE) THEN 'Overdue'
        WHEN DATEADD(DAY, RotationIntervalDays, LastPasswordChangeDate) = CAST(SYSUTCDATETIME() AS DATE) THEN 'DueToday'
        WHEN DATEADD(DAY, RotationIntervalDays, LastPasswordChangeDate) <= DATEADD(DAY, @dueSoonDays, CAST(SYSUTCDATETIME() AS DATE)) THEN 'DueSoon'
        ELSE 'Current'
      END
    WHERE IsDeleted = 0
  `);
  return result.rowsAffected[0] ?? 0;
}

// --- Patch/Update Logs, Software Inventory, Maintenance Logs ---------------------------------
// (list/create/update follow the identical shape as Password Change Logs above; generic row
// mapping keeps this file from ballooning into four more near-duplicate blocks.)

function mapPatchLog(r: Record<string, unknown>): PatchUpdateLog {
  return {
    id: r.Id as number,
    assetId: r.AssetId as number,
    updateType: r.UpdateType as PatchUpdateLog["updateType"],
    vendor: r.Vendor as string | null,
    product: r.Product as string | null,
    patchName: r.PatchName as string,
    kbOrPatchReference: r.KbOrPatchReference as string | null,
    version: r.Version as string | null,
    severity: r.Severity as PatchUpdateLog["severity"],
    releaseDate: formatDate(r.ReleaseDate as Date | null),
    scheduledInstallationDate: formatDate(r.ScheduledInstallationDate as Date | null),
    actualInstallationDate: formatDate(r.ActualInstallationDate as Date | null),
    installationStatus: r.InstallationStatus as PatchUpdateLog["installationStatus"],
    rebootRequired: r.RebootRequired as boolean,
    rebootCompleted: r.RebootCompleted as boolean,
    validationStatus: r.ValidationStatus as PatchUpdateLog["validationStatus"],
    validationDate: formatDate(r.ValidationDate as Date | null),
    installedBy: r.InstalledBy as string | null,
    approvedBy: r.ApprovedBy as string | null,
    changeRequestNumber: r.ChangeRequestNumber as string | null,
    failureReason: r.FailureReason as string | null,
    rollbackPerformed: r.RollbackPerformed as boolean,
    rollbackDetails: r.RollbackDetails as string | null,
    notes: r.Notes as string | null,
    createdAt: r.CreatedAt as Date,
    createdByUserId: r.CreatedByUserId as number | null,
    createdByUsername: r.CreatedByUsername as string | null,
    updatedAt: r.UpdatedAt as Date,
    updatedByUserId: r.UpdatedByUserId as number | null,
    updatedByUsername: r.UpdatedByUsername as string | null,
  };
}

export async function listPatchLogsForAsset(assetId: number): Promise<PatchUpdateLog[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .query(`SELECT * FROM PatchUpdateLogs WHERE AssetId = @assetId AND IsDeleted = 0 ORDER BY COALESCE(ActualInstallationDate, ScheduledInstallationDate) DESC`);
  return result.recordset.map(mapPatchLog);
}

export async function createPatchLog(assetId: number, data: Record<string, unknown>, actor: { userId: number; username: string }): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .input("updateType", sql.VarChar, data.updateType)
    .input("vendor", sql.NVarChar, data.vendor ?? null)
    .input("product", sql.NVarChar, data.product ?? null)
    .input("patchName", sql.NVarChar, data.patchName)
    .input("kbOrPatchReference", sql.NVarChar, data.kbOrPatchReference ?? null)
    .input("version", sql.NVarChar, data.version ?? null)
    .input("severity", sql.VarChar, data.severity ?? "Medium")
    .input("releaseDate", sql.Date, data.releaseDate ?? null)
    .input("scheduledInstallationDate", sql.Date, data.scheduledInstallationDate ?? null)
    .input("actualInstallationDate", sql.Date, data.actualInstallationDate ?? null)
    .input("installationStatus", sql.VarChar, data.installationStatus ?? "Planned")
    .input("rebootRequired", sql.Bit, data.rebootRequired ?? false)
    .input("rebootCompleted", sql.Bit, data.rebootCompleted ?? false)
    .input("validationStatus", sql.VarChar, data.validationStatus ?? "Pending")
    .input("validationDate", sql.Date, data.validationDate ?? null)
    .input("installedBy", sql.NVarChar, data.installedBy ?? null)
    .input("approvedBy", sql.NVarChar, data.approvedBy ?? null)
    .input("changeRequestNumber", sql.NVarChar, data.changeRequestNumber ?? null)
    .input("failureReason", sql.NVarChar, data.failureReason ?? null)
    .input("rollbackPerformed", sql.Bit, data.rollbackPerformed ?? false)
    .input("rollbackDetails", sql.NVarChar, data.rollbackDetails ?? null)
    .input("notes", sql.NVarChar, data.notes ?? null)
    .input("createdByUserId", sql.Int, actor.userId)
    .input("createdByUsername", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO PatchUpdateLogs (
        AssetId, UpdateType, Vendor, Product, PatchName, KbOrPatchReference, Version, Severity,
        ReleaseDate, ScheduledInstallationDate, ActualInstallationDate, InstallationStatus,
        RebootRequired, RebootCompleted, ValidationStatus, ValidationDate, InstalledBy, ApprovedBy,
        ChangeRequestNumber, FailureReason, RollbackPerformed, RollbackDetails, Notes,
        CreatedByUserId, CreatedByUsername, UpdatedByUserId, UpdatedByUsername
      )
      OUTPUT INSERTED.Id
      VALUES (
        @assetId, @updateType, @vendor, @product, @patchName, @kbOrPatchReference, @version, @severity,
        @releaseDate, @scheduledInstallationDate, @actualInstallationDate, @installationStatus,
        @rebootRequired, @rebootCompleted, @validationStatus, @validationDate, @installedBy, @approvedBy,
        @changeRequestNumber, @failureReason, @rollbackPerformed, @rollbackDetails, @notes,
        @createdByUserId, @createdByUsername, @createdByUserId, @createdByUsername
      )
    `);
  return result.recordset[0].Id;
}

export async function getPatchLogById(id: number): Promise<PatchUpdateLog | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`SELECT * FROM PatchUpdateLogs WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset[0] ? mapPatchLog(result.recordset[0]) : null;
}

// Re-validates the same three business rules the create schema enforces (failure reason
// required when Failed, rollback details required when a rollback happened, date order) against
// the merged (existing + patch) record - the zod update schema can't express these via .refine()
// once .partial() is applied, so this is the actual enforcement point for updates.
export async function updatePatchLog(
  id: number,
  data: Record<string, unknown>,
  actor: { userId: number; username: string }
): Promise<{ error: string } | void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query(`SELECT * FROM PatchUpdateLogs WHERE Id = @id AND IsDeleted = 0`);
  const row = existing.recordset[0];
  if (!row) return { error: "Patch record not found" };

  const merged = { ...row, ...data };
  const installationStatus = merged.installationStatus ?? merged.InstallationStatus;
  const failureReason = data.failureReason !== undefined ? data.failureReason : row.FailureReason;
  const rollbackPerformed = data.rollbackPerformed !== undefined ? data.rollbackPerformed : row.RollbackPerformed;
  const rollbackDetails = data.rollbackDetails !== undefined ? data.rollbackDetails : row.RollbackDetails;
  const scheduled = data.scheduledInstallationDate !== undefined ? data.scheduledInstallationDate : formatDate(row.ScheduledInstallationDate);
  const actual = data.actualInstallationDate !== undefined ? data.actualInstallationDate : formatDate(row.ActualInstallationDate);

  if (installationStatus === "Failed" && !failureReason) {
    return { error: "Failed installations must include a failure reason." };
  }
  if (rollbackPerformed && !rollbackDetails) {
    return { error: "A rollback must include rollback details." };
  }
  if (actual && scheduled && actual < scheduled) {
    return { error: "Actual installation date cannot be earlier than the scheduled date." };
  }

  await db
    .request()
    .input("id", sql.Int, id)
    .input("updateType", sql.VarChar, merged.UpdateType ?? merged.updateType)
    .input("vendor", sql.NVarChar, data.vendor !== undefined ? data.vendor : row.Vendor)
    .input("product", sql.NVarChar, data.product !== undefined ? data.product : row.Product)
    .input("patchName", sql.NVarChar, merged.PatchName ?? merged.patchName)
    .input("kbOrPatchReference", sql.NVarChar, data.kbOrPatchReference !== undefined ? data.kbOrPatchReference : row.KbOrPatchReference)
    .input("version", sql.NVarChar, data.version !== undefined ? data.version : row.Version)
    .input("severity", sql.VarChar, data.severity ?? row.Severity)
    .input("releaseDate", sql.Date, data.releaseDate !== undefined ? data.releaseDate : row.ReleaseDate)
    .input("scheduledInstallationDate", sql.Date, scheduled)
    .input("actualInstallationDate", sql.Date, actual)
    .input("installationStatus", sql.VarChar, installationStatus)
    .input("rebootRequired", sql.Bit, data.rebootRequired !== undefined ? data.rebootRequired : row.RebootRequired)
    .input("rebootCompleted", sql.Bit, data.rebootCompleted !== undefined ? data.rebootCompleted : row.RebootCompleted)
    .input("validationStatus", sql.VarChar, data.validationStatus ?? row.ValidationStatus)
    .input("validationDate", sql.Date, data.validationDate !== undefined ? data.validationDate : row.ValidationDate)
    .input("installedBy", sql.NVarChar, data.installedBy !== undefined ? data.installedBy : row.InstalledBy)
    .input("approvedBy", sql.NVarChar, data.approvedBy !== undefined ? data.approvedBy : row.ApprovedBy)
    .input("changeRequestNumber", sql.NVarChar, data.changeRequestNumber !== undefined ? data.changeRequestNumber : row.ChangeRequestNumber)
    .input("failureReason", sql.NVarChar, failureReason)
    .input("rollbackPerformed", sql.Bit, rollbackPerformed)
    .input("rollbackDetails", sql.NVarChar, rollbackDetails)
    .input("notes", sql.NVarChar, data.notes !== undefined ? data.notes : row.Notes)
    .input("updatedByUserId", sql.Int, actor.userId)
    .input("updatedByUsername", sql.NVarChar, actor.username)
    .query(`
      UPDATE PatchUpdateLogs SET
        UpdateType = @updateType, Vendor = @vendor, Product = @product, PatchName = @patchName,
        KbOrPatchReference = @kbOrPatchReference, Version = @version, Severity = @severity,
        ReleaseDate = @releaseDate, ScheduledInstallationDate = @scheduledInstallationDate,
        ActualInstallationDate = @actualInstallationDate, InstallationStatus = @installationStatus,
        RebootRequired = @rebootRequired, RebootCompleted = @rebootCompleted, ValidationStatus = @validationStatus,
        ValidationDate = @validationDate, InstalledBy = @installedBy, ApprovedBy = @approvedBy,
        ChangeRequestNumber = @changeRequestNumber, FailureReason = @failureReason,
        RollbackPerformed = @rollbackPerformed, RollbackDetails = @rollbackDetails, Notes = @notes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId, UpdatedByUsername = @updatedByUsername
      WHERE Id = @id
    `);
}

export async function softDeletePatchLog(id: number, deletedByUserId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("deletedByUserId", sql.Int, deletedByUserId)
    .query(`UPDATE PatchUpdateLogs SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedByUserId = @deletedByUserId WHERE Id = @id`);
}

export interface PatchLogFilter {
  severity?: string;
  installationStatus?: string;
  page?: number;
  pageSize?: number;
}

export async function listPatchLogs(filter: PatchLogFilter): Promise<{ logs: (PatchUpdateLog & { assetTag: string; hostname: string | null })[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const req = db
    .request()
    .input("severity", sql.VarChar, filter.severity ?? null)
    .input("installationStatus", sql.VarChar, filter.installationStatus ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);
  const where = `
    WHERE p.IsDeleted = 0 AND a.IsDeleted = 0
      AND (@severity IS NULL OR p.Severity = @severity)
      AND (@installationStatus IS NULL OR p.InstallationStatus = @installationStatus)
  `;
  const [rows, count] = await Promise.all([
    req.query(`
      SELECT p.*, a.AssetTag, a.Hostname FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId
      ${where} ORDER BY p.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query(`SELECT COUNT(*) AS Total FROM PatchUpdateLogs p JOIN Assets a ON a.Id = p.AssetId ${where}`),
  ]);
  return {
    logs: rows.recordset.map((r: Record<string, unknown>) => ({ ...mapPatchLog(r), assetTag: r.AssetTag as string, hostname: r.Hostname as string | null })),
    total: count.recordset[0].Total as number,
  };
}

function mapSoftware(r: Record<string, unknown>): SoftwareInventoryItem {
  return {
    id: r.Id as number,
    assetId: r.AssetId as number,
    softwareName: r.SoftwareName as string,
    publisher: r.Publisher as string | null,
    installedVersion: r.InstalledVersion as string | null,
    latestApprovedVersion: r.LatestApprovedVersion as string | null,
    installationDate: formatDate(r.InstallationDate as Date | null),
    installedBy: r.InstalledBy as string | null,
    installationSource: r.InstallationSource as string | null,
    licenceType: r.LicenceType as string | null,
    licenceKeyRef: r.LicenceKeyRef as string | null,
    licenceExpiryDate: formatDate(r.LicenceExpiryDate as Date | null),
    numberOfLicences: r.NumberOfLicences as number | null,
    businessOwner: r.BusinessOwner as string | null,
    technicalOwner: r.TechnicalOwner as string | null,
    approvalStatus: r.ApprovalStatus as SoftwareInventoryItem["approvalStatus"],
    softwareStatus: r.SoftwareStatus as SoftwareInventoryItem["softwareStatus"],
    lastUpdatedDate: formatDate(r.LastUpdatedDate as Date | null),
    uninstallationDate: formatDate(r.UninstallationDate as Date | null),
    uninstalledBy: r.UninstalledBy as string | null,
    reasonForRemoval: r.ReasonForRemoval as string | null,
    notes: r.Notes as string | null,
    createdAt: r.CreatedAt as Date,
    createdByUserId: r.CreatedByUserId as number | null,
    createdByUsername: r.CreatedByUsername as string | null,
    updatedAt: r.UpdatedAt as Date,
    updatedByUserId: r.UpdatedByUserId as number | null,
    updatedByUsername: r.UpdatedByUsername as string | null,
  };
}

export interface SoftwareFilter {
  softwareStatus?: string;
  approvalStatus?: string;
  page?: number;
  pageSize?: number;
}

export async function listSoftware(filter: SoftwareFilter): Promise<{ items: (SoftwareInventoryItem & { assetTag: string })[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const req = db
    .request()
    .input("softwareStatus", sql.VarChar, filter.softwareStatus ?? null)
    .input("approvalStatus", sql.VarChar, filter.approvalStatus ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);
  const where = `
    WHERE s.IsDeleted = 0 AND a.IsDeleted = 0
      AND (@softwareStatus IS NULL OR s.SoftwareStatus = @softwareStatus)
      AND (@approvalStatus IS NULL OR s.ApprovalStatus = @approvalStatus)
  `;
  const [rows, count] = await Promise.all([
    req.query(`
      SELECT s.*, a.AssetTag FROM SoftwareInventory s JOIN Assets a ON a.Id = s.AssetId
      ${where} ORDER BY s.SoftwareName ASC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query(`SELECT COUNT(*) AS Total FROM SoftwareInventory s JOIN Assets a ON a.Id = s.AssetId ${where}`),
  ]);
  return {
    items: rows.recordset.map((r: Record<string, unknown>) => ({ ...mapSoftware(r), assetTag: r.AssetTag as string })),
    total: count.recordset[0].Total as number,
  };
}

export interface MaintenanceFilter {
  status?: string;
  activityType?: string;
  page?: number;
  pageSize?: number;
}

export async function listMaintenance(filter: MaintenanceFilter): Promise<{ items: (MaintenanceLog & { assetTag: string })[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const req = db
    .request()
    .input("status", sql.VarChar, filter.status ?? null)
    .input("activityType", sql.VarChar, filter.activityType ?? null)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);
  const where = `
    WHERE m.IsDeleted = 0 AND a.IsDeleted = 0
      AND (@status IS NULL OR m.Status = @status)
      AND (@activityType IS NULL OR m.ActivityType = @activityType)
  `;
  const [rows, count] = await Promise.all([
    req.query(`
      SELECT m.*, a.AssetTag FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId
      ${where} ORDER BY COALESCE(m.CompletedAt, m.ScheduledDate) DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query(`SELECT COUNT(*) AS Total FROM MaintenanceLogs m JOIN Assets a ON a.Id = m.AssetId ${where}`),
  ]);
  return {
    items: rows.recordset.map((r: Record<string, unknown>) => ({ ...mapMaintenance(r), assetTag: r.AssetTag as string })),
    total: count.recordset[0].Total as number,
  };
}

export async function listSoftwareForAsset(assetId: number): Promise<SoftwareInventoryItem[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .query(`SELECT * FROM SoftwareInventory WHERE AssetId = @assetId AND IsDeleted = 0 ORDER BY SoftwareName ASC`);
  return result.recordset.map(mapSoftware);
}

export async function createSoftware(assetId: number, data: Record<string, unknown>, actor: { userId: number; username: string }): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .input("softwareName", sql.NVarChar, data.softwareName)
    .input("publisher", sql.NVarChar, data.publisher ?? null)
    .input("installedVersion", sql.NVarChar, data.installedVersion ?? null)
    .input("latestApprovedVersion", sql.NVarChar, data.latestApprovedVersion ?? null)
    .input("installationDate", sql.Date, data.installationDate ?? null)
    .input("installedBy", sql.NVarChar, data.installedBy ?? null)
    .input("installationSource", sql.NVarChar, data.installationSource ?? null)
    .input("licenceType", sql.NVarChar, data.licenceType ?? null)
    .input("licenceKeyRef", sql.NVarChar, data.licenceKeyRef ?? null)
    .input("licenceExpiryDate", sql.Date, data.licenceExpiryDate ?? null)
    .input("numberOfLicences", sql.Int, data.numberOfLicences ?? null)
    .input("businessOwner", sql.NVarChar, data.businessOwner ?? null)
    .input("technicalOwner", sql.NVarChar, data.technicalOwner ?? null)
    .input("approvalStatus", sql.VarChar, data.approvalStatus ?? "PendingApproval")
    .input("softwareStatus", sql.VarChar, data.softwareStatus ?? "Installed")
    .input("lastUpdatedDate", sql.Date, data.lastUpdatedDate ?? null)
    .input("uninstallationDate", sql.Date, data.uninstallationDate ?? null)
    .input("uninstalledBy", sql.NVarChar, data.uninstalledBy ?? null)
    .input("reasonForRemoval", sql.NVarChar, data.reasonForRemoval ?? null)
    .input("notes", sql.NVarChar, data.notes ?? null)
    .input("createdByUserId", sql.Int, actor.userId)
    .input("createdByUsername", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO SoftwareInventory (
        AssetId, SoftwareName, Publisher, InstalledVersion, LatestApprovedVersion, InstallationDate,
        InstalledBy, InstallationSource, LicenceType, LicenceKeyRef, LicenceExpiryDate, NumberOfLicences,
        BusinessOwner, TechnicalOwner, ApprovalStatus, SoftwareStatus, LastUpdatedDate, UninstallationDate,
        UninstalledBy, ReasonForRemoval, Notes, CreatedByUserId, CreatedByUsername, UpdatedByUserId, UpdatedByUsername
      )
      OUTPUT INSERTED.Id
      VALUES (
        @assetId, @softwareName, @publisher, @installedVersion, @latestApprovedVersion, @installationDate,
        @installedBy, @installationSource, @licenceType, @licenceKeyRef, @licenceExpiryDate, @numberOfLicences,
        @businessOwner, @technicalOwner, @approvalStatus, @softwareStatus, @lastUpdatedDate, @uninstallationDate,
        @uninstalledBy, @reasonForRemoval, @notes, @createdByUserId, @createdByUsername, @createdByUserId, @createdByUsername
      )
    `);
  return result.recordset[0].Id;
}

function mapMaintenance(r: Record<string, unknown>): MaintenanceLog {
  return {
    id: r.Id as number,
    assetId: r.AssetId as number,
    activityType: r.ActivityType as MaintenanceLog["activityType"],
    activityTitle: r.ActivityTitle as string,
    description: r.Description as string | null,
    scheduledDate: formatDate(r.ScheduledDate as Date | null),
    startAt: r.StartAt as Date | null,
    completedAt: r.CompletedAt as Date | null,
    status: r.Status as MaintenanceLog["status"],
    priority: r.Priority as MaintenanceLog["priority"],
    performedBy: r.PerformedBy as string | null,
    requestedBy: r.RequestedBy as string | null,
    approvedBy: r.ApprovedBy as string | null,
    downtimeMinutes: r.DowntimeMinutes as number | null,
    serviceImpact: r.ServiceImpact as string | null,
    changeRequestNumber: r.ChangeRequestNumber as string | null,
    incidentNumber: r.IncidentNumber as string | null,
    result: r.Result as string | null,
    followUpRequired: r.FollowUpRequired as boolean,
    followUpDate: formatDate(r.FollowUpDate as Date | null),
    notes: r.Notes as string | null,
    createdAt: r.CreatedAt as Date,
    createdByUserId: r.CreatedByUserId as number | null,
    createdByUsername: r.CreatedByUsername as string | null,
    updatedAt: r.UpdatedAt as Date,
    updatedByUserId: r.UpdatedByUserId as number | null,
    updatedByUsername: r.UpdatedByUsername as string | null,
  };
}

export async function listMaintenanceForAsset(assetId: number): Promise<MaintenanceLog[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .query(`SELECT * FROM MaintenanceLogs WHERE AssetId = @assetId AND IsDeleted = 0 ORDER BY COALESCE(CompletedAt, ScheduledDate) DESC`);
  return result.recordset.map(mapMaintenance);
}

// Enforces "retired assets cannot receive new maintenance records unless reactivated" (spec
// section 20) - checked here rather than only in the API route so every caller gets the rule.
export async function createMaintenanceLog(assetId: number, data: Record<string, unknown>, actor: { userId: number; username: string }): Promise<number | { error: string }> {
  const asset = await getAssetById(assetId);
  if (!asset) return { error: "Asset not found" };
  if (asset.status === "Retired" || asset.status === "Disposed") {
    return { error: `Cannot add maintenance records to a ${asset.status.toLowerCase()} asset. Reactivate it first.` };
  }

  const db = await getDb();
  const result = await db
    .request()
    .input("assetId", sql.Int, assetId)
    .input("activityType", sql.VarChar, data.activityType)
    .input("activityTitle", sql.NVarChar, data.activityTitle)
    .input("description", sql.NVarChar, data.description ?? null)
    .input("scheduledDate", sql.Date, data.scheduledDate ?? null)
    .input("startAt", sql.DateTime2, data.startAt ?? null)
    .input("completedAt", sql.DateTime2, data.completedAt ?? null)
    .input("status", sql.VarChar, data.status ?? "Planned")
    .input("priority", sql.VarChar, data.priority ?? "Medium")
    .input("performedBy", sql.NVarChar, data.performedBy ?? null)
    .input("requestedBy", sql.NVarChar, data.requestedBy ?? null)
    .input("approvedBy", sql.NVarChar, data.approvedBy ?? null)
    .input("downtimeMinutes", sql.Int, data.downtimeMinutes ?? null)
    .input("serviceImpact", sql.NVarChar, data.serviceImpact ?? null)
    .input("changeRequestNumber", sql.NVarChar, data.changeRequestNumber ?? null)
    .input("incidentNumber", sql.NVarChar, data.incidentNumber ?? null)
    .input("result", sql.NVarChar, data.result ?? null)
    .input("followUpRequired", sql.Bit, data.followUpRequired ?? false)
    .input("followUpDate", sql.Date, data.followUpDate ?? null)
    .input("notes", sql.NVarChar, data.notes ?? null)
    .input("createdByUserId", sql.Int, actor.userId)
    .input("createdByUsername", sql.NVarChar, actor.username)
    .query<{ Id: number }>(`
      INSERT INTO MaintenanceLogs (
        AssetId, ActivityType, ActivityTitle, Description, ScheduledDate, StartAt, CompletedAt, Status,
        Priority, PerformedBy, RequestedBy, ApprovedBy, DowntimeMinutes, ServiceImpact, ChangeRequestNumber,
        IncidentNumber, Result, FollowUpRequired, FollowUpDate, Notes,
        CreatedByUserId, CreatedByUsername, UpdatedByUserId, UpdatedByUsername
      )
      OUTPUT INSERTED.Id
      VALUES (
        @assetId, @activityType, @activityTitle, @description, @scheduledDate, @startAt, @completedAt, @status,
        @priority, @performedBy, @requestedBy, @approvedBy, @downtimeMinutes, @serviceImpact, @changeRequestNumber,
        @incidentNumber, @result, @followUpRequired, @followUpDate, @notes,
        @createdByUserId, @createdByUsername, @createdByUserId, @createdByUsername
      )
    `);
  return result.recordset[0].Id;
}

export async function getPasswordLogById(id: number): Promise<PasswordChangeLog | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`SELECT * FROM PasswordChangeLogs WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset[0] ? mapPasswordLog(result.recordset[0]) : null;
}

export async function softDeletePasswordLog(id: number, deletedByUserId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("deletedByUserId", sql.Int, deletedByUserId)
    .query(`UPDATE PasswordChangeLogs SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedByUserId = @deletedByUserId WHERE Id = @id`);
}

export async function getSoftwareById(id: number): Promise<SoftwareInventoryItem | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`SELECT * FROM SoftwareInventory WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset[0] ? mapSoftware(result.recordset[0]) : null;
}

export async function updateSoftware(id: number, data: Record<string, unknown>, actor: { userId: number; username: string }): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query(`SELECT * FROM SoftwareInventory WHERE Id = @id AND IsDeleted = 0`);
  const row = existing.recordset[0];
  if (!row) return;
  const pick = (key: string, col: string) => (data[key] !== undefined ? data[key] : row[col]);

  await db
    .request()
    .input("id", sql.Int, id)
    .input("softwareName", sql.NVarChar, pick("softwareName", "SoftwareName"))
    .input("publisher", sql.NVarChar, pick("publisher", "Publisher"))
    .input("installedVersion", sql.NVarChar, pick("installedVersion", "InstalledVersion"))
    .input("latestApprovedVersion", sql.NVarChar, pick("latestApprovedVersion", "LatestApprovedVersion"))
    .input("installationDate", sql.Date, pick("installationDate", "InstallationDate"))
    .input("installedBy", sql.NVarChar, pick("installedBy", "InstalledBy"))
    .input("installationSource", sql.NVarChar, pick("installationSource", "InstallationSource"))
    .input("licenceType", sql.NVarChar, pick("licenceType", "LicenceType"))
    .input("licenceKeyRef", sql.NVarChar, pick("licenceKeyRef", "LicenceKeyRef"))
    .input("licenceExpiryDate", sql.Date, pick("licenceExpiryDate", "LicenceExpiryDate"))
    .input("numberOfLicences", sql.Int, pick("numberOfLicences", "NumberOfLicences"))
    .input("businessOwner", sql.NVarChar, pick("businessOwner", "BusinessOwner"))
    .input("technicalOwner", sql.NVarChar, pick("technicalOwner", "TechnicalOwner"))
    .input("approvalStatus", sql.VarChar, pick("approvalStatus", "ApprovalStatus"))
    .input("softwareStatus", sql.VarChar, pick("softwareStatus", "SoftwareStatus"))
    .input("lastUpdatedDate", sql.Date, pick("lastUpdatedDate", "LastUpdatedDate"))
    .input("uninstallationDate", sql.Date, pick("uninstallationDate", "UninstallationDate"))
    .input("uninstalledBy", sql.NVarChar, pick("uninstalledBy", "UninstalledBy"))
    .input("reasonForRemoval", sql.NVarChar, pick("reasonForRemoval", "ReasonForRemoval"))
    .input("notes", sql.NVarChar, pick("notes", "Notes"))
    .input("updatedByUserId", sql.Int, actor.userId)
    .input("updatedByUsername", sql.NVarChar, actor.username)
    .query(`
      UPDATE SoftwareInventory SET
        SoftwareName = @softwareName, Publisher = @publisher, InstalledVersion = @installedVersion,
        LatestApprovedVersion = @latestApprovedVersion, InstallationDate = @installationDate, InstalledBy = @installedBy,
        InstallationSource = @installationSource, LicenceType = @licenceType, LicenceKeyRef = @licenceKeyRef,
        LicenceExpiryDate = @licenceExpiryDate, NumberOfLicences = @numberOfLicences, BusinessOwner = @businessOwner,
        TechnicalOwner = @technicalOwner, ApprovalStatus = @approvalStatus, SoftwareStatus = @softwareStatus,
        LastUpdatedDate = @lastUpdatedDate, UninstallationDate = @uninstallationDate, UninstalledBy = @uninstalledBy,
        ReasonForRemoval = @reasonForRemoval, Notes = @notes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId, UpdatedByUsername = @updatedByUsername
      WHERE Id = @id
    `);
}

export async function softDeleteSoftware(id: number, deletedByUserId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("deletedByUserId", sql.Int, deletedByUserId)
    .query(`UPDATE SoftwareInventory SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedByUserId = @deletedByUserId WHERE Id = @id`);
}

export async function getMaintenanceLogById(id: number): Promise<MaintenanceLog | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query(`SELECT * FROM MaintenanceLogs WHERE Id = @id AND IsDeleted = 0`);
  return result.recordset[0] ? mapMaintenance(result.recordset[0]) : null;
}

export async function updateMaintenanceLog(id: number, data: Record<string, unknown>, actor: { userId: number; username: string }): Promise<{ error: string } | void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query(`SELECT * FROM MaintenanceLogs WHERE Id = @id AND IsDeleted = 0`);
  const row = existing.recordset[0];
  if (!row) return { error: "Maintenance record not found" };
  const pick = (key: string, col: string) => (data[key] !== undefined ? data[key] : row[col]);

  const startAt = pick("startAt", "StartAt");
  const completedAt = pick("completedAt", "CompletedAt");
  if (completedAt && startAt && new Date(completedAt) < new Date(startAt)) {
    return { error: "Completion date cannot be earlier than the start date." };
  }

  await db
    .request()
    .input("id", sql.Int, id)
    .input("activityType", sql.VarChar, pick("activityType", "ActivityType"))
    .input("activityTitle", sql.NVarChar, pick("activityTitle", "ActivityTitle"))
    .input("description", sql.NVarChar, pick("description", "Description"))
    .input("scheduledDate", sql.Date, pick("scheduledDate", "ScheduledDate"))
    .input("startAt", sql.DateTime2, startAt)
    .input("completedAt", sql.DateTime2, completedAt)
    .input("status", sql.VarChar, pick("status", "Status"))
    .input("priority", sql.VarChar, pick("priority", "Priority"))
    .input("performedBy", sql.NVarChar, pick("performedBy", "PerformedBy"))
    .input("requestedBy", sql.NVarChar, pick("requestedBy", "RequestedBy"))
    .input("approvedBy", sql.NVarChar, pick("approvedBy", "ApprovedBy"))
    .input("downtimeMinutes", sql.Int, pick("downtimeMinutes", "DowntimeMinutes"))
    .input("serviceImpact", sql.NVarChar, pick("serviceImpact", "ServiceImpact"))
    .input("changeRequestNumber", sql.NVarChar, pick("changeRequestNumber", "ChangeRequestNumber"))
    .input("incidentNumber", sql.NVarChar, pick("incidentNumber", "IncidentNumber"))
    .input("result", sql.NVarChar, pick("result", "Result"))
    .input("followUpRequired", sql.Bit, pick("followUpRequired", "FollowUpRequired"))
    .input("followUpDate", sql.Date, pick("followUpDate", "FollowUpDate"))
    .input("notes", sql.NVarChar, pick("notes", "Notes"))
    .input("updatedByUserId", sql.Int, actor.userId)
    .input("updatedByUsername", sql.NVarChar, actor.username)
    .query(`
      UPDATE MaintenanceLogs SET
        ActivityType = @activityType, ActivityTitle = @activityTitle, Description = @description,
        ScheduledDate = @scheduledDate, StartAt = @startAt, CompletedAt = @completedAt, Status = @status,
        Priority = @priority, PerformedBy = @performedBy, RequestedBy = @requestedBy, ApprovedBy = @approvedBy,
        DowntimeMinutes = @downtimeMinutes, ServiceImpact = @serviceImpact, ChangeRequestNumber = @changeRequestNumber,
        IncidentNumber = @incidentNumber, Result = @result, FollowUpRequired = @followUpRequired,
        FollowUpDate = @followUpDate, Notes = @notes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId, UpdatedByUsername = @updatedByUsername
      WHERE Id = @id
    `);
}

export async function softDeleteMaintenanceLog(id: number, deletedByUserId: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).input("deletedByUserId", sql.Int, deletedByUserId)
    .query(`UPDATE MaintenanceLogs SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedByUserId = @deletedByUserId WHERE Id = @id`);
}

// --- Lookup values -------------------------------------------------------------------------

export async function listLookupValues(category?: string): Promise<{ id: number; category: string; value: string; sortOrder: number }[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("category", sql.VarChar, category ?? null)
    .query(`SELECT * FROM ItAssetLookupValues WHERE IsActive = 1 AND (@category IS NULL OR Category = @category) ORDER BY Category, SortOrder, Value`);
  return result.recordset.map((r: Record<string, unknown>) => ({ id: r.Id as number, category: r.Category as string, value: r.Value as string, sortOrder: r.SortOrder as number }));
}

export async function createLookupValue(category: string, value: string, sortOrder: number, createdByUserId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("category", sql.VarChar, category)
    .input("value", sql.NVarChar, value)
    .input("sortOrder", sql.Int, sortOrder)
    .input("createdByUserId", sql.Int, createdByUserId)
    .query<{ Id: number }>(`INSERT INTO ItAssetLookupValues (Category, Value, SortOrder, CreatedByUserId) OUTPUT INSERTED.Id VALUES (@category, @value, @sortOrder, @createdByUserId)`);
  return result.recordset[0].Id;
}

// --- Dashboard stats -----------------------------------------------------------------------

export async function getDashboardStats(): Promise<Record<string, number>> {
  const db = await getDb();
  const result = await db.query`
    SELECT
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND Status = 'Active') AS TotalActiveAssets,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND AssetType = 'Server') AS TotalServers,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND AssetType IN ('Desktop','Laptop')) AS TotalDesktopsLaptops,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND Status = 'UnderMaintenance') AS AssetsUnderMaintenance,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND Status = 'Retired') AS RetiredAssets,
      (SELECT COUNT(*) FROM PasswordChangeLogs WHERE IsDeleted = 0 AND Status = 'Overdue') AS PasswordChangesOverdue,
      (SELECT COUNT(*) FROM PasswordChangeLogs WHERE IsDeleted = 0 AND Status IN ('DueSoon','DueToday')) AS PasswordChangesDueSoon,
      (SELECT COUNT(*) FROM PatchUpdateLogs WHERE IsDeleted = 0 AND Severity = 'Critical' AND InstallationStatus IN ('Planned','Scheduled','InProgress')) AS CriticalPatchesPending,
      (SELECT COUNT(*) FROM PatchUpdateLogs WHERE IsDeleted = 0 AND InstallationStatus = 'Failed') AS FailedPatchInstallations,
      (SELECT COUNT(*) FROM SoftwareInventory WHERE IsDeleted = 0 AND SoftwareStatus = 'UpdateRequired') AS SoftwareRequiringUpdates,
      (SELECT COUNT(*) FROM SoftwareInventory WHERE IsDeleted = 0 AND SoftwareStatus = 'Unsupported') AS UnsupportedSoftware,
      (SELECT COUNT(*) FROM SoftwareInventory WHERE IsDeleted = 0 AND LicenceExpiryDate IS NOT NULL AND LicenceExpiryDate <= DATEADD(DAY, 30, SYSUTCDATETIME())) AS LicencesExpiringSoon,
      (SELECT COUNT(*) FROM MaintenanceLogs WHERE IsDeleted = 0 AND Status IN ('Planned','Scheduled') AND ScheduledDate <= DATEADD(DAY, 7, SYSUTCDATETIME())) AS MaintenanceTasksDue,
      (SELECT COUNT(*) FROM MaintenanceLogs WHERE IsDeleted = 0 AND Status IN ('Planned','Scheduled') AND ScheduledDate < CAST(SYSUTCDATETIME() AS DATE)) AS OverdueMaintenanceTasks,
      (SELECT COUNT(*) FROM Assets WHERE IsDeleted = 0 AND (NextInventoryCheckDate IS NULL OR NextInventoryCheckDate < CAST(SYSUTCDATETIME() AS DATE))) AS AssetsNotCheckedRecently
  `;
  return result.recordset[0];
}

export type { Asset, PasswordChangeLog, PatchUpdateLog, SoftwareInventoryItem, MaintenanceLog, AssetAttachment };

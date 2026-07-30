import ExcelJS from "exceljs";
import { getDb, sql } from "../db";
import { createAssetSchema } from "./schema";
import { createAsset, findAssetDuplicates } from "./repository";
import type { Asset } from "./types";
import type { ExportColumn } from "./exportHelpers";

// The asset-list export column set doubles as the import template's header row, so a
// downloaded template always matches exactly what re-exporting the list would produce - one
// source of truth for "what a row of Assets looks like" on the import/export boundary,
// separate from ASSET_COLUMNS in reports.ts (which is a display-only subset for report rows,
// not a round-trippable import shape).
export const ASSET_IMPORT_COLUMNS: { header: string; key: keyof Asset; required?: boolean }[] = [
  { header: "Asset Tag", key: "assetTag", required: true },
  { header: "Hostname", key: "hostname" },
  { header: "Device Name", key: "deviceName" },
  { header: "Asset Type", key: "assetType", required: true },
  { header: "Device Category", key: "deviceCategory" },
  { header: "Manufacturer", key: "manufacturer" },
  { header: "Model", key: "model" },
  { header: "Serial Number", key: "serialNumber" },
  { header: "Operating System", key: "operatingSystem" },
  { header: "OS Version", key: "osVersion" },
  { header: "IP Address", key: "ipAddress" },
  { header: "MAC Address", key: "macAddress" },
  { header: "Domain/Workgroup", key: "domainOrWorkgroup" },
  { header: "Department", key: "department" },
  { header: "Location", key: "location" },
  { header: "Assigned User", key: "assignedUser" },
  { header: "Asset Owner", key: "assetOwner" },
  { header: "Responsible Technician", key: "responsibleTechnician" },
  { header: "Purchase Date (YYYY-MM-DD)", key: "purchaseDate" },
  { header: "Warranty Expiry Date (YYYY-MM-DD)", key: "warrantyExpiryDate" },
  { header: "Installation Date (YYYY-MM-DD)", key: "installationDate" },
  { header: "Status", key: "status" },
  { header: "Criticality", key: "criticality" },
  { header: "Environment", key: "environment" },
  { header: "Notes", key: "notes" },
];

export const ASSET_LIST_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Asset Tag", key: "assetTag", width: 16 },
  { header: "Hostname", key: "hostname", width: 18 },
  { header: "Device Name", key: "deviceName", width: 18 },
  { header: "Asset Type", key: "assetType", width: 14 },
  { header: "Manufacturer", key: "manufacturer", width: 16 },
  { header: "Model", key: "model", width: 18 },
  { header: "Serial Number", key: "serialNumber", width: 18 },
  { header: "Department", key: "department", width: 16 },
  { header: "Location", key: "location", width: 16 },
  { header: "Assigned User", key: "assignedUser", width: 16 },
  { header: "IP Address", key: "ipAddress", width: 14 },
  { header: "Status", key: "status", width: 14 },
  { header: "Criticality", key: "criticality", width: 12 },
];

function assetToExportRow(a: Asset): Record<string, string> {
  const val = (v: unknown) => (v === null || v === undefined ? "" : v instanceof Date ? v.toISOString().slice(0, 10) : String(v));
  return {
    assetTag: val(a.assetTag), hostname: val(a.hostname), deviceName: val(a.deviceName), assetType: val(a.assetType),
    manufacturer: val(a.manufacturer), model: val(a.model), serialNumber: val(a.serialNumber), department: val(a.department),
    location: val(a.location), assignedUser: val(a.assignedUser), ipAddress: val(a.ipAddress), status: val(a.status),
    criticality: val(a.criticality),
  };
}

export function buildAssetExportRows(assets: Asset[]): Record<string, string>[] {
  return assets.map(assetToExportRow);
}

export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Assets");
  sheet.columns = ASSET_IMPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  // One example row, styled distinctly and never counted as real data by the importer (it's
  // never uploaded back - this is purely a downloaded reference for column order/format).
  sheet.addRow({
    assetTag: "SRV-0001", hostname: "srv-web-01", assetType: "Server", manufacturer: "Dell",
    model: "PowerEdge R740", serialNumber: "ABC123XYZ", status: "Active", criticality: "High",
    purchaseDate: "2024-01-15", warrantyExpiryDate: "2027-01-15",
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF888888" } };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Maps by header TEXT (case-insensitive, trimmed) rather than assuming column order/count -
// a user who re-orders, deletes, or adds columns in the downloaded template (or builds their
// own sheet with the same header names) still imports correctly, rather than silently reading
// the wrong column into the wrong field.
export function mapImportHeaders(headerRow: string[]): (keyof Asset | null)[] {
  const byHeader = new Map(ASSET_IMPORT_COLUMNS.map((c) => [c.header.toLowerCase(), c.key]));
  return headerRow.map((h) => byHeader.get(h.trim().toLowerCase()) ?? null);
}

export function mapImportRow(mappedHeaders: (keyof Asset | null)[], dataRow: string[]): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  mappedHeaders.forEach((key, i) => {
    if (key) record[key] = dataRow[i] ?? "";
  });
  return record;
}

export interface ImportRowResult {
  rowNumber: number; // 1-based, matching the spreadsheet row (header = row 1)
  status: "imported" | "skipped_duplicate" | "invalid";
  assetTag?: string;
  errors?: string[];
}

// Pure validation of one already-parsed row (a plain object keyed by ASSET_IMPORT_COLUMNS'
// `key`s) against the same zod schema the manual "Add Asset" form uses - a row that would be
// rejected by the API is rejected here too, for the same reason, before ever reaching the DB.
// Deliberately does NOT check duplicates (that needs a DB round-trip) - see importAssetRows.
export function validateImportRow(raw: Record<string, unknown>): { valid: true; data: Record<string, unknown> } | { valid: false; errors: string[] } {
  const candidate: Record<string, unknown> = {};
  for (const col of ASSET_IMPORT_COLUMNS) {
    const value = raw[col.key];
    if (typeof value === "string" && value.trim() === "") continue; // blank cell -> field omitted, not an empty string
    candidate[col.key] = value;
  }
  const parsed = createAssetSchema.safeParse(candidate);
  if (!parsed.success) {
    return { valid: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`) };
  }
  return { valid: true, data: parsed.data };
}

export interface ImportSummary {
  totalRows: number;
  importedRows: number;
  failedRows: number;
  results: ImportRowResult[];
}

// Row 1 is the header; sheetRows here are the data rows only, each a Record<string, unknown>
// already keyed by ASSET_IMPORT_COLUMNS' `key`s (the caller is responsible for turning raw
// spreadsheet cells into that shape - see the /import route for the Excel/CSV parsing step).
export async function importAssetRows(sheetRows: Record<string, unknown>[], actor: { userId: number; username: string }): Promise<ImportSummary> {
  const results: ImportRowResult[] = [];
  let imported = 0;

  for (let i = 0; i < sheetRows.length; i++) {
    const rowNumber = i + 2; // +1 for header, +1 for 1-based
    const validation = validateImportRow(sheetRows[i]);
    if (!validation.valid) {
      results.push({ rowNumber, status: "invalid", errors: validation.errors });
      continue;
    }

    const data = validation.data as { assetTag: string; serialNumber?: string | null; hostname?: string | null; ipAddress?: string | null };
    const duplicates = await findAssetDuplicates({
      assetTag: data.assetTag,
      serialNumber: data.serialNumber ?? undefined,
      hostname: data.hostname ?? undefined,
      ipAddress: data.ipAddress ?? undefined,
    });
    if (duplicates.length > 0) {
      results.push({
        rowNumber,
        status: "skipped_duplicate",
        assetTag: data.assetTag,
        errors: [`Matches existing asset ${duplicates[0].assetTag} on Asset Tag, Serial Number, Hostname, or IP Address.`],
      });
      continue;
    }

    await createAsset(validation.data, actor);
    imported++;
    results.push({ rowNumber, status: "imported", assetTag: data.assetTag });
  }

  return {
    totalRows: sheetRows.length,
    importedRows: imported,
    failedRows: sheetRows.length - imported,
    results,
  };
}

export async function recordImportHistory(summary: ImportSummary, fileName: string, actor: { userId: number; username: string }): Promise<void> {
  const db = await getDb();
  const errorReport = summary.results.filter((r) => r.status !== "imported");
  await db
    .request()
    .input("targetTable", sql.VarChar, "Assets")
    .input("fileName", sql.NVarChar, fileName)
    .input("totalRows", sql.Int, summary.totalRows)
    .input("importedRows", sql.Int, summary.importedRows)
    .input("failedRows", sql.Int, summary.failedRows)
    .input("errorReportJson", sql.NVarChar, errorReport.length > 0 ? JSON.stringify(errorReport) : null)
    .input("importedByUserId", sql.Int, actor.userId)
    .input("importedByUsername", sql.NVarChar, actor.username)
    .query(`
      INSERT INTO ItAssetImportHistory (TargetTable, FileName, TotalRows, ImportedRows, FailedRows, ErrorReportJson, ImportedByUserId, ImportedByUsername)
      VALUES (@targetTable, @fileName, @totalRows, @importedRows, @failedRows, @errorReportJson, @importedByUserId, @importedByUsername)
    `);
}

export interface ImportHistoryRow {
  id: number;
  targetTable: string;
  fileName: string;
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errorReportJson: string | null;
  importedByUsername: string | null;
  importedAt: Date;
}

export async function listImportHistory(limit = 50): Promise<ImportHistoryRow[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<{
      Id: number; TargetTable: string; FileName: string; TotalRows: number; ImportedRows: number;
      FailedRows: number; ErrorReportJson: string | null; ImportedByUsername: string | null; ImportedAt: Date;
    }>("SELECT TOP (@limit) * FROM ItAssetImportHistory ORDER BY ImportedAt DESC");
  return result.recordset.map((r) => ({
    id: r.Id, targetTable: r.TargetTable, fileName: r.FileName, totalRows: r.TotalRows,
    importedRows: r.ImportedRows, failedRows: r.FailedRows, errorReportJson: r.ErrorReportJson,
    importedByUsername: r.ImportedByUsername, importedAt: r.ImportedAt,
  }));
}

// Bulk update: applies the same partial patch (a subset of the manual edit form's fields) to
// every asset ID in one request. Deliberately restricted to a curated field allowlist (not the
// full ASSET_INSERT_COLUMNS set updateAsset() accepts) - bulk-editing something like Asset Tag
// or Serial Number across many rows at once is never a legitimate operation and would silently
// create duplicate-key confusion, whereas status/department/location/criticality/assignedUser
// are exactly the fields a real "move these 40 laptops to the new office" or "retire this
// batch" workflow needs.
export const BULK_UPDATE_ALLOWED_FIELDS = ["status", "department", "location", "criticality", "assignedUser", "responsibleTechnician"] as const;
export type BulkUpdateField = (typeof BULK_UPDATE_ALLOWED_FIELDS)[number];

export function sanitizeBulkUpdatePatch(raw: Record<string, unknown>): Partial<Record<BulkUpdateField, unknown>> {
  const patch: Partial<Record<BulkUpdateField, unknown>> = {};
  for (const field of BULK_UPDATE_ALLOWED_FIELDS) {
    if (field in raw) patch[field] = raw[field];
  }
  return patch;
}

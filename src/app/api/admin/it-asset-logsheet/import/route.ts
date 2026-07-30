import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { parseCsv } from "@/lib/csv";
import { mapImportHeaders, mapImportRow, importAssetRows, recordImportHistory } from "@/lib/itAssetLogsheet/importExport";

const MAX_IMPORT_ROWS = 5000; // bounded and intentional - see the "no silent caps" note elsewhere in this module

async function extractRows(file: File): Promise<{ headerRow: string[]; dataRows: string[][] } | { error: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) return { error: "The file is empty." };
    return { headerRow: rows[0], dataRows: rows.slice(1) };
  }

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- exceljs's bundled Buffer type doesn't structurally match this TS/node version's generic Buffer<T>
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return { error: "The workbook has no worksheets." };
    const rows: string[][] = [];
    sheet.eachRow((row) => {
      const values = (row.values as unknown[]).slice(1); // exceljs pads index 0 with an empty slot
      rows.push(values.map((v) => (v === null || v === undefined ? "" : String(v))));
    });
    if (rows.length === 0) return { error: "The worksheet is empty." };
    return { headerRow: rows[0], dataRows: rows.slice(1) };
  }

  return { error: "Unsupported file type - upload a .xlsx or .csv file." };
}

// Validates every row (duplicate detection + the same zod schema the manual "Add Asset" form
// uses), persists whichever rows are valid and non-duplicate as new assets, and records one
// ItAssetImportHistory row with the full error report for anything that wasn't imported - see
// importExport.ts for why invalid/duplicate rows are skipped rather than the whole file being
// rejected on the first bad row.
export async function POST(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_import");
  if (!isItAssetSession(ita)) return ita;

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
  }

  const extracted = await extractRows(file);
  if ("error" in extracted) {
    return NextResponse.json({ ok: false, error: extracted.error }, { status: 400 });
  }

  const { headerRow, dataRows } = extracted;
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return NextResponse.json({ ok: false, error: `This file has ${dataRows.length} rows, which exceeds the ${MAX_IMPORT_ROWS}-row limit per import. Split it into smaller files.` }, { status: 400 });
  }

  const mappedHeaders = mapImportHeaders(headerRow);
  if (!mappedHeaders.includes("assetTag") || !mappedHeaders.includes("assetType")) {
    return NextResponse.json({ ok: false, error: "The file must include 'Asset Tag' and 'Asset Type' columns - download the import template for the exact column names." }, { status: 400 });
  }

  const sheetRows = dataRows
    .filter((row) => row.some((cell) => cell.trim() !== "")) // skip fully-blank rows (common trailing rows in spreadsheets)
    .map((row) => mapImportRow(mappedHeaders, row));

  const summary = await importAssetRows(sheetRows, { userId: ita.userId, username: ita.username });
  await recordImportHistory(summary, file.name, { userId: ita.userId, username: ita.username });
  await logAdminAction({
    admin: ita,
    section: "it-asset-logsheet",
    action: "asset_import",
    details: JSON.stringify({ fileName: file.name, totalRows: summary.totalRows, importedRows: summary.importedRows, failedRows: summary.failedRows }),
    req,
  });

  return NextResponse.json({ ok: true, data: summary });
}

import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { listAssets } from "@/lib/itAssetLogsheet/repository";
import { buildAssetExportRows, ASSET_LIST_EXPORT_COLUMNS } from "@/lib/itAssetLogsheet/importExport";
import { buildCsv, buildExcel, buildPdf, exportContentType, exportFileExtension } from "@/lib/itAssetLogsheet/exportHelpers";

// Exports the Asset Register list honoring the same filters as the on-screen table
// (AssetRegisterClient) - a CSV/Excel/PDF export of "what I'm currently looking at", not
// unconditionally the whole register, matching the convention already used for every other
// list export in this app.
export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_export");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const format = params.get("format") ?? "csv";
  const { assets } = await listAssets({
    search: params.get("search") ?? undefined,
    assetType: params.get("assetType") ?? undefined,
    status: params.get("status") ?? undefined,
    criticality: params.get("criticality") ?? undefined,
    department: params.get("department") ?? undefined,
    location: params.get("location") ?? undefined,
    assignedUser: params.get("assignedUser") ?? undefined,
    technician: params.get("technician") ?? undefined,
    pageSize: 10000, // export cap - bounded and intentional, not silent (register is expected to stay well under this)
  });

  const rows = buildAssetExportRows(assets);
  let body: Buffer | string;
  if (format === "excel") body = await buildExcel(ASSET_LIST_EXPORT_COLUMNS, rows, "Assets");
  else if (format === "pdf") body = await buildPdf(ASSET_LIST_EXPORT_COLUMNS, rows, "IT Asset Register", new Date());
  else body = buildCsv(ASSET_LIST_EXPORT_COLUMNS, rows);

  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "asset_list_export", details: JSON.stringify({ format, rowCount: rows.length }), req });

  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": exportContentType(format),
      "Content-Disposition": `attachment; filename="it-asset-register-${new Date().toISOString().slice(0, 10)}.${exportFileExtension(format)}"`,
    },
  });
}

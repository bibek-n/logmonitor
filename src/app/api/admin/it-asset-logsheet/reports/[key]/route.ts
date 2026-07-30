import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { getReportData, REPORT_DEFINITIONS } from "@/lib/itAssetLogsheet/reports";
import { buildCsv, buildExcel, buildPdf, exportContentType, exportFileExtension } from "@/lib/itAssetLogsheet/exportHelpers";

// A single route handles both the on-screen preview (no ?format, returns JSON) and the
// CSV/Excel/PDF export of the same report (?format=csv|excel|pdf) - one query per report key,
// reused for both, so the preview table and the downloaded file can never disagree.
export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ita = await requireItAssetPermission("ita_reports_view");
  if (!isItAssetSession(ita)) return ita;

  const { key } = await params;
  const definition = REPORT_DEFINITIONS.find((d) => d.key === key);
  if (!definition) {
    return NextResponse.json({ ok: false, error: "Unknown report type." }, { status: 404 });
  }

  const data = await getReportData(key);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Unknown report type." }, { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format");
  if (!format) {
    return NextResponse.json({ ok: true, data: { title: definition.title, columns: data.columns, rows: data.rows } });
  }

  let body: Buffer | string;
  if (format === "excel") body = await buildExcel(data.columns, data.rows, definition.title);
  else if (format === "pdf") body = await buildPdf(data.columns, data.rows, definition.title, new Date());
  else body = buildCsv(data.columns, data.rows);

  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "report_export", details: JSON.stringify({ report: key, format, rowCount: data.rows.length }), req });

  return new NextResponse(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": exportContentType(format),
      "Content-Disposition": `attachment; filename="it-asset-${key}-${new Date().toISOString().slice(0, 10)}.${exportFileExtension(format)}"`,
    },
  });
}

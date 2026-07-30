import { NextResponse } from "next/server";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { buildImportTemplate } from "@/lib/itAssetLogsheet/importExport";

export async function GET() {
  const ita = await requireItAssetPermission("ita_import");
  if (!isItAssetSession(ita)) return ita;

  const buffer = await buildImportTemplate();
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="it-asset-import-template.xlsx"',
    },
  });
}

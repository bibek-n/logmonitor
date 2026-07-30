import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import {
  getAssetById,
  listPasswordLogsForAsset,
  listPatchLogsForAsset,
  listSoftwareForAsset,
  listMaintenanceForAsset,
} from "@/lib/itAssetLogsheet/repository";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

// The "printable asset history" export from the spec - one PDF combining the asset's core
// details with all four of its log types, for handoff/audit/offline reference. Pure JS
// pdfkit, no native bindings, same convention as every other PDF export in this app.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ita = await requireItAssetPermission("ita_export");
  if (!isItAssetSession(ita)) return ita;

  const { id: idParam } = await params;
  const id = Number(idParam);
  const asset = await getAssetById(id);
  if (!asset) {
    return NextResponse.json({ ok: false, error: "Asset not found." }, { status: 404 });
  }

  const [passwordLogs, patchLogs, software, maintenance] = await Promise.all([
    listPasswordLogsForAsset(id),
    listPatchLogsForAsset(id),
    listSoftwareForAsset(id),
    listMaintenanceForAsset(id),
  ]);

  const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  doc.fontSize(18).text(`Asset History — ${asset.assetTag}`);
  doc.fontSize(9).fillColor("#666").text(`Generated ${new Date().toUTCString()}`);
  doc.moveDown(0.5);
  doc.fillColor("#000").fontSize(11).text("Asset Details", { underline: true });
  doc.fontSize(9);
  const details = [
    ["Hostname", fmt(asset.hostname)], ["Device Name", fmt(asset.deviceName)], ["Type", fmt(asset.assetType)],
    ["Manufacturer", fmt(asset.manufacturer)], ["Model", fmt(asset.model)], ["Serial Number", fmt(asset.serialNumber)],
    ["Operating System", fmt(asset.operatingSystem)], ["IP Address", fmt(asset.ipAddress)], ["Department", fmt(asset.department)],
    ["Location", fmt(asset.location)], ["Assigned User", fmt(asset.assignedUser)], ["Status", fmt(asset.status)],
    ["Criticality", fmt(asset.criticality)], ["Purchase Date", fmt(asset.purchaseDate)], ["Warranty Expiry", fmt(asset.warrantyExpiryDate)],
  ];
  for (const [label, value] of details) {
    doc.text(`${label}: ${value}`);
  }

  function section(title: string, rows: string[][], headers: string[]) {
    doc.moveDown(0.8);
    doc.fontSize(11).text(title, { underline: true });
    doc.fontSize(8);
    if (rows.length === 0) {
      doc.fillColor("#888").text("None recorded.").fillColor("#000");
      return;
    }
    doc.text(headers.join("  |  "), { continued: false });
    for (const row of rows) {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 20) doc.addPage();
      doc.text(row.join("  |  "));
    }
  }

  section(
    "Password / Credential Changes",
    passwordLogs.map((p) => [fmt(p.accountOrServiceName), fmt(p.accountType), fmt(p.lastPasswordChangeDate), fmt(p.nextPasswordChangeDate), fmt(p.status)]),
    ["Account", "Type", "Last Changed", "Next Due", "Status"]
  );
  section(
    "Patches & Updates",
    patchLogs.map((p) => [fmt(p.patchName), fmt(p.severity), fmt(p.installationStatus), fmt(p.actualInstallationDate)]),
    ["Patch", "Severity", "Status", "Installed"]
  );
  section(
    "Software Inventory",
    software.map((sw) => [fmt(sw.softwareName), fmt(sw.installedVersion), fmt(sw.softwareStatus), fmt(sw.licenceExpiryDate)]),
    ["Software", "Version", "Status", "Licence Expiry"]
  );
  section(
    "Maintenance Log",
    maintenance.map((m) => [fmt(m.activityTitle), fmt(m.activityType), fmt(m.status), fmt(m.scheduledDate)]),
    ["Activity", "Type", "Status", "Scheduled"]
  );

  doc.end();
  const buffer = await done;

  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "asset_history_export", details: asset.assetTag, req });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="asset-history-${asset.assetTag}.pdf"`,
    },
  });
}

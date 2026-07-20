import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { logAdminAction } from "@/lib/adminAudit";
import { createScanRow, executeScan, type StartScanOptions } from "@/lib/codeQuality/runScan";

interface OldScanRow {
  ProjectId: number;
  Branch: string | null;
  ScanType: "Full" | "Incremental";
  ConfigSnapshot: string | null;
  ProjectStatus: string;
}

// Re-runs a past scan's project/branch/config as a brand-new scan row - it does not mutate
// or resume the original row, matching "Retry Scan" reading as "run it again," not "un-fail
// this one."
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cq = await requireCodeQualityPermission("cq_scan_start");
  if (!isCqSession(cq)) return cq;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ ok: false, error: "Invalid scan id" }, { status: 400 });

  const db = await getDb();
  const oldScan = await db.request().input("id", sql.Int, id).query<OldScanRow>(`
    SELECT s.ProjectId, s.Branch, s.ScanType, s.ConfigSnapshot, p.Status AS ProjectStatus
    FROM CodeQualityScans s JOIN CodeQualityProjects p ON p.Id = s.ProjectId
    WHERE s.Id = @id AND p.DeletedAt IS NULL
  `);
  const row = oldScan.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Scan not found" }, { status: 404 });
  if (row.ProjectStatus !== "Active") return NextResponse.json({ ok: false, error: "Cannot scan an inactive project." }, { status: 400 });

  const inFlight = await db
    .request()
    .input("projectId", sql.Int, row.ProjectId)
    .query<{ Cnt: number }>("SELECT COUNT(*) AS Cnt FROM CodeQualityScans WHERE ProjectId = @projectId AND Status IN ('Pending', 'Queued', 'Running')");
  if (inFlight.recordset[0].Cnt > 0) {
    return NextResponse.json({ ok: false, error: "A scan is already running for this project." }, { status: 409 });
  }

  let overrides: StartScanOptions["overrides"] = {};
  try {
    overrides = row.ConfigSnapshot ? JSON.parse(row.ConfigSnapshot) : {};
  } catch {
    overrides = {};
  }

  const scanOptions: StartScanOptions = {
    projectId: row.ProjectId,
    branch: row.Branch,
    scanType: row.ScanType,
    startedByUserId: cq.userId,
    overrides,
  };

  const newScanId = await createScanRow(scanOptions);
  void executeScan(newScanId, scanOptions).catch((err) => {
    console.error(`[code-quality] retry scan ${newScanId} background execution error:`, err instanceof Error ? err.message : err);
  });

  await logAdminAction({ admin: cq, section: "code-quality", action: "retry_scan", details: `Retried scan #${id} as #${newScanId}`, req });

  return NextResponse.json({ ok: true, data: { scanId: newScanId } }, { status: 202 });
}

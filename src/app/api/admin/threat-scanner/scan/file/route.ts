import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { validateScanFile, saveScanFile, MAX_SCAN_FILE_BYTES } from "@/lib/threatScanner/fileStorage";
import { createScanRow, runFileScan } from "@/lib/threatScanner/runScan";

export const runtime = "nodejs";

// Always responds 200 (see website-security/scan/route.ts) - this app's IIS front end
// replaces non-2xx response bodies with a generic HTML error page, which would otherwise
// hand the dashboard's res.json() an HTML document instead of {ok:false, error}.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ ok: false, error: "Invalid form submission." });

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "A file is required." });

  const validation = validateScanFile(file.name, file.size);
  if (!validation.ok) return NextResponse.json({ ok: false, error: validation.error });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = await saveScanFile(buffer, file.name);

  let scanId: number;
  try {
    scanId = await createScanRow({
      kind: "File",
      target: file.name,
      originalFileName: file.name,
      contentType: file.type || null,
      sizeBytes: file.size,
      filePath,
      triggeredByUserId: admin.userId,
      triggeredByUsername: admin.username,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to start scan." });
  }

  // Extracted now, synchronously, while `req` is still guaranteed valid - reading it from
  // inside the fire-and-forget continuation below (which can run up to ~2 minutes later, long
  // after this response has been sent) throws. See the identical fix/comment in
  // website-security/scan/route.ts, where this exact mistake silently broke report emails.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  // Fire-and-forget: VirusTotal's own multi-engine analysis can take up to ~2 minutes (see
  // runScan.ts's poll budget) - far longer than a single request should be held open. The
  // dashboard polls GET /api/admin/threat-scanner/scans/[id] for live progress/completion.
  void runFileScan(scanId, buffer, file.name)
    .then(() => logAdminAction({ admin, section: "threat-scanner", action: "scan_file", details: file.name, ipAddress: clientIp }))
    .catch((err) => {
      console.error(`[threat-scanner] file scan ${scanId} did not complete:`, err instanceof Error ? err.message : err);
    });

  return NextResponse.json({ ok: true, scanId, maxFileBytes: MAX_SCAN_FILE_BYTES });
}

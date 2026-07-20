import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Environment: string;
  LastScanId: number | null;
  LastScore: number | null;
  LastGrade: string | null;
  LastScanAt: string | null;
}

// Dropdown/list source is the shared Websites registry ("save it once on the Audit Websites
// page, pick it here") - same convention as Malware Detection's website scan panel.
export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<WebsiteRow>`
    SELECT w.Id, w.Name, w.Url, w.Environment,
      (SELECT TOP 1 Id FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastScanId,
      (SELECT TOP 1 Score FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastScore,
      (SELECT TOP 1 Grade FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC) AS LastGrade,
      CONVERT(VARCHAR(19), (SELECT TOP 1 ScannedAt FROM SeoScans s WHERE s.WebsiteId = w.Id ORDER BY s.ScannedAt DESC), 126) AS LastScanAt
    FROM Websites w
    WHERE w.Enabled = 1
    ORDER BY w.Name ASC
  `;

  return NextResponse.json({ ok: true, data: result.recordset });
}

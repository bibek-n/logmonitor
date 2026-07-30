import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isSecurityCenterSession, requireSecurityCenterPermission } from "@/lib/requireSecurityCenterPermission";

// Websites Security Center can target - the same shared registry Security Headers, WP Scan,
// Malware Detection's website scans, and Intrusion Detection already read from (see the
// approved plan - Vulnerability Scanner targets this table, not a new one).
export async function GET() {
  const sc = await requireSecurityCenterPermission("sc_view");
  if (!isSecurityCenterSession(sc)) return sc;

  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; Url: string }>("SELECT Id, Name, Url FROM Websites WHERE Enabled = 1 ORDER BY Name ASC");
  return NextResponse.json({ ok: true, data: result.recordset });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { isValidUrl } from "@/lib/websiteTools";
import { syncProtectedWebsites } from "@/lib/intrusionDetection/websiteSync";

// Lists every website with the fields needed to manage it (Enabled, in addition to
// Name/Url) - the protected-applications endpoint only returns the IDS-facing view
// (Id/Name/AppType/WebsiteId), not enough to drive an edit form.
export async function GET() {
  const session = await requireSecurityRole("viewer");
  if (!isSecuritySession(session)) return session;

  const db = await getDb();
  const result = await db.query`SELECT Id, Name, Url, Enabled FROM Websites ORDER BY Name`;
  return NextResponse.json({ ok: true, data: result.recordset });
}

// Adds a website to the app's existing Websites table (the same registry Security Headers,
// WP Scan, and Website Speed & Performance already read from) rather than a separate
// IDS-only list - so a website added here also shows up in those other audit tools, and vice
// versa. Runs the same sync the collector runs every pass so the new website appears as a
// protected application immediately, without waiting up to 5 minutes for the next pass.
export async function POST(req: NextRequest) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: "Enter a valid URL starting with http:// or https://" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("url", sql.NVarChar, url).query<{ Id: number }>(`SELECT Id FROM Websites WHERE Url = @url`);
  if (existing.recordset.length > 0) {
    return NextResponse.json({ ok: false, error: "This website is already in the list." }, { status: 409 });
  }

  await db.request().input("name", sql.NVarChar, name).input("url", sql.NVarChar, url).query(`INSERT INTO Websites (Name, Url) VALUES (@name, @url)`);
  await syncProtectedWebsites();

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "website_add", details: `${name} (${url})`, req });

  return NextResponse.json({ ok: true });
}

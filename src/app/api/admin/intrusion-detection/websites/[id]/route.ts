import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireSecurityRole, isSecuritySession } from "@/lib/intrusionDetection/requireSecurityRole";
import { logAdminAction } from "@/lib/adminAudit";
import { isValidUrl } from "@/lib/websiteTools";
import { syncProtectedWebsites } from "@/lib/intrusionDetection/websiteSync";

interface WebsiteRow {
  Id: number;
  Name: string;
  Url: string;
  Enabled: boolean;
}

// Edits a website's name/URL, or toggles it enabled/disabled - same Websites table every
// other audit tool reads from, so the change is visible everywhere, not just in IDS.
// Disabling (rather than deleting) is what removes it from active monitoring across the
// whole app; syncProtectedWebsites() then deactivates (not deletes) its protected-application
// row, so historical events/alerts tied to it stay intact.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const websiteId = Number(id);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, websiteId).query<WebsiteRow>(`SELECT Id, Name, Url, Enabled FROM Websites WHERE Id = @id`);
  const current = existing.recordset[0];
  if (!current) {
    return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : current.Name;
  const url = typeof body?.url === "string" ? body.url.trim() : current.Url;
  const enabled = typeof body?.enabled === "boolean" ? body.enabled : Boolean(current.Enabled);

  if (!name) {
    return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  }
  if (!isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: "Enter a valid URL starting with http:// or https://" }, { status: 400 });
  }

  await db
    .request()
    .input("id", sql.Int, websiteId)
    .input("name", sql.NVarChar, name)
    .input("url", sql.NVarChar, url)
    .input("enabled", sql.Bit, enabled)
    .query(`UPDATE Websites SET Name = @name, Url = @url, Enabled = @enabled WHERE Id = @id`);
  await syncProtectedWebsites();

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "website_update", details: `${name} (${url}) enabled=${enabled}`, req });

  return NextResponse.json({ ok: true });
}

// Hard delete - matches the existing Audit Websites page's own removeWebsite() behavior, so
// the two management surfaces stay consistent rather than silently diverging (one soft, one
// hard). syncProtectedWebsites() then deactivates the corresponding protected-application row
// (it can't reference a WebsiteId that no longer exists) without deleting IDS history.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSecurityRole("security_admin");
  if (!isSecuritySession(session)) return session;

  const { id } = await params;
  const websiteId = Number(id);
  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, websiteId).query<{ Name: string }>(`SELECT Name FROM Websites WHERE Id = @id`);
  if (!existing.recordset[0]) {
    return NextResponse.json({ ok: false, error: "Website not found." }, { status: 404 });
  }

  await db.request().input("id", sql.Int, websiteId).query(`DELETE FROM Websites WHERE Id = @id`);
  await syncProtectedWebsites();

  await logAdminAction({ admin: session, section: "intrusion-detection", action: "website_remove", details: existing.recordset[0].Name, req });

  return NextResponse.json({ ok: true });
}

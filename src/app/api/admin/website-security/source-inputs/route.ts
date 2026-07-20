import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { ecosystemForFilename } from "@/lib/websiteSecurityAudit/dependencyChecks";

// Package/code checks only run when an admin has voluntarily supplied a lockfile and/or a
// source snippet for a website (per the plan: repository/SSH access is out of scope for v1).
// Content size is capped generously but finitely — this is a manifest/snippet upload, not a
// file store.
const MAX_CONTENT_LENGTH = 2_000_000;

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const websiteId = Number(body?.websiteId);
  const lockfileFilename = typeof body?.lockfileFilename === "string" ? body.lockfileFilename.trim() : "";
  const lockfileContent = typeof body?.lockfileContent === "string" ? body.lockfileContent : "";
  const sourceSnippet = typeof body?.sourceSnippet === "string" ? body.sourceSnippet : "";

  if (!Number.isInteger(websiteId) || websiteId <= 0) {
    return NextResponse.json({ ok: false, error: "websiteId is required" }, { status: 400 });
  }
  if (lockfileContent.length > MAX_CONTENT_LENGTH || sourceSnippet.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ ok: false, error: "Content is too large." }, { status: 400 });
  }

  const db = await getDb();
  const websiteResult = await db.request().input("id", sql.Int, websiteId).query<{ Id: number; Name: string }>("SELECT Id, Name FROM Websites WHERE Id = @id");
  const website = websiteResult.recordset[0];
  if (!website) return NextResponse.json({ ok: false, error: "Website not found" }, { status: 404 });

  const ecosystem = lockfileFilename ? ecosystemForFilename(lockfileFilename) : null;

  // Blank fields mean "leave what's already saved" (so re-saving the filename alone doesn't
  // wipe a previously-pasted lockfile/snippet) — only a non-empty value overwrites its column.
  await db
    .request()
    .input("websiteId", sql.Int, websiteId)
    .input("ecosystem", sql.NVarChar, ecosystem)
    .input("lockfileFilename", sql.NVarChar, lockfileFilename || null)
    .input("lockfileContent", sql.NVarChar, lockfileContent || null)
    .input("sourceSnippet", sql.NVarChar, sourceSnippet || null).query(`
      MERGE WebsiteAuditSourceInputs AS target
      USING (SELECT @websiteId AS WebsiteId) AS src ON target.WebsiteId = src.WebsiteId
      WHEN MATCHED THEN UPDATE SET
        Ecosystem = COALESCE(@ecosystem, target.Ecosystem),
        LockfileFilename = COALESCE(@lockfileFilename, target.LockfileFilename),
        LockfileContent = COALESCE(@lockfileContent, target.LockfileContent),
        SourceSnippet = COALESCE(@sourceSnippet, target.SourceSnippet),
        UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (WebsiteId, Ecosystem, LockfileFilename, LockfileContent, SourceSnippet)
        VALUES (@websiteId, @ecosystem, @lockfileFilename, @lockfileContent, @sourceSnippet);
    `);

  await logAdminAction({
    admin,
    section: "website-security",
    action: "update_source_inputs",
    details: `${website.Name} — ${lockfileFilename || "(no lockfile)"}${sourceSnippet ? " + source snippet" : ""}`,
    req,
  });

  return NextResponse.json({ ok: true });
}

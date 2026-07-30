import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Hard delete (not soft) - unlike Block/Allow policy entries, there's no value in keeping a
// disabled watched-file row around for audit purposes; the FileIntegrityEvents history it
// produced stands on its own and isn't affected by removing the watch itself.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, entryId).query<{ FilePath: string }>("SELECT FilePath FROM WatchedFiles WHERE Id = @id");
  const row = existing.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Entry not found." }, { status: 404 });

  await db.request().input("id", sql.Int, entryId).query("DELETE FROM WatchedFiles WHERE Id = @id");
  await logAdminAction({ admin, section: "file-integrity", action: "watched_file_remove", details: row.FilePath, req });

  return NextResponse.json({ ok: true });
}

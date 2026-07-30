import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logAdminAction } from "@/lib/adminAudit";
import { writeAuditEvent } from "@/lib/remoteAccess/auditLog";
import { isRemoteAccessSession, requireRemoteAccessPermission } from "@/lib/requireRemoteAccessPermission";
import { deleteRemoteFile } from "@/lib/remoteAccess/connectionService";

// Client-side confirmation happens before this is ever called (per the spec's "require
// confirmation before deleting or overwriting files"); confirm is still re-checked here.
const deleteSchema = z.object({ connectionId: z.number().int().positive(), path: z.string().min(1), isDirectory: z.boolean().default(false), confirm: z.literal(true) });

export async function DELETE(req: NextRequest) {
  const ra = await requireRemoteAccessPermission("ra_file_delete");
  if (!isRemoteAccessSession(ra)) return ra;

  const body = await req.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "connectionId, path, and confirmation are required" }, { status: 400 });

  try {
    await deleteRemoteFile(parsed.data.connectionId, parsed.data.path, parsed.data.isDirectory);
    await writeAuditEvent({ eventType: "FileDeleted", userId: ra.userId, username: ra.username, connectionId: parsed.data.connectionId, action: parsed.data.path, result: "Success" });
    await logAdminAction({ admin: ra, section: "remote-access", action: "file_delete", details: parsed.data.path, req });
    return NextResponse.json({ ok: true });
  } catch (err) {
    await writeAuditEvent({ eventType: "FileDeleted", userId: ra.userId, username: ra.username, connectionId: parsed.data.connectionId, action: parsed.data.path, result: "Failure", failureReason: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Delete failed" }, { status: 400 });
  }
}

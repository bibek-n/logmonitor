import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Soft delete (IsActive = 0) rather than a real DELETE - keeps the history of what was once
// declared blocked/allowed and why, for audit purposes, same as the intrusion detection
// blocklist/allowlist.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, entryId)
    .query<{ Action: string; VendorId: string | null; ProductId: string | null; SerialNumber: string | null; DeviceNamePattern: string | null }>(
      "SELECT Action, VendorId, ProductId, SerialNumber, DeviceNamePattern FROM UsbDevicePolicies WHERE Id = @id AND IsActive = 1"
    );
  const row = existing.recordset[0];
  if (!row) return NextResponse.json({ ok: false, error: "Entry not found." }, { status: 404 });

  await db.request().input("id", sql.Int, entryId).query("UPDATE UsbDevicePolicies SET IsActive = 0 WHERE Id = @id");

  const label = [
    row.VendorId && `VID ${row.VendorId}`,
    row.ProductId && `PID ${row.ProductId}`,
    row.SerialNumber && `serial ${row.SerialNumber}`,
    row.DeviceNamePattern,
  ]
    .filter(Boolean)
    .join(", ");
  await logAdminAction({
    admin,
    section: "usb-control",
    action: row.Action === "Block" ? "usb_block_remove" : "usb_allow_remove",
    details: label,
    req,
  });

  return NextResponse.json({ ok: true });
}

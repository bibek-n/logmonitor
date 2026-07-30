import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

const VALID_ACTIONS = new Set(["Block", "Allow"]);

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const action = req.nextUrl.searchParams.get("action");
  const db = await getDb();
  const request = db.request();
  let where = "IsActive = 1";
  if (action && VALID_ACTIONS.has(action)) {
    request.input("action", sql.VarChar, action);
    where += " AND Action = @action";
  }

  const result = await request.query(`
    SELECT Id, Action, VendorId, ProductId, SerialNumber, DeviceNamePattern, Reason, CreatedByUserId, CONVERT(VARCHAR(19), CreatedAt, 126) AS CreatedAt
    FROM UsbDevicePolicies WHERE ${where} ORDER BY CreatedAt DESC
  `);
  return NextResponse.json({ ok: true, data: result.recordset });
}

// Block entries are enforced for real on Windows endpoints: the agent picks up the active
// Block list on every heartbeat and applies it via Windows Device Installation Restriction
// policy + Disable-PnpDevice for already-connected matches (agent/usbpolicy_windows.go).
// A VendorId+ProductId pair gets the strongest treatment (blocks future connections too, via
// the DenyDeviceIDs registry policy); Serial/Name-pattern-only entries only disable devices
// that are actually plugged in at the time the agent checks (no registry-level future block,
// since Windows' policy can't match on serial number or a free-text name). Linux endpoints
// receive this same list but have no enforcement wired up (Linux USB detection doesn't capture
// vendor/product IDs at all - see agent/usb_linux.go) - Allow entries are recorded for
// visibility/audit only, same as before: there's no "default-deny except allow-listed" mode,
// so an Allow entry has nothing to override yet.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";
  const vendorId = typeof body?.vendorId === "string" ? body.vendorId.trim().toLowerCase() : "";
  const productId = typeof body?.productId === "string" ? body.productId.trim().toLowerCase() : "";
  const serialNumber = typeof body?.serialNumber === "string" ? body.serialNumber.trim() : "";
  const deviceNamePattern = typeof body?.deviceNamePattern === "string" ? body.deviceNamePattern.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 500) : null;

  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "action must be Block or Allow." }, { status: 400 });
  }
  if (!vendorId && !serialNumber && !deviceNamePattern) {
    return NextResponse.json(
      { ok: false, error: "Provide at least one of: vendor ID, serial number, or device name pattern." },
      { status: 400 }
    );
  }
  if (productId && !vendorId) {
    return NextResponse.json({ ok: false, error: "A product ID requires a vendor ID too." }, { status: 400 });
  }

  const db = await getDb();
  await db
    .request()
    .input("action", sql.VarChar, action)
    .input("vendorId", sql.VarChar, vendorId || null)
    .input("productId", sql.VarChar, productId || null)
    .input("serialNumber", sql.NVarChar, serialNumber || null)
    .input("deviceNamePattern", sql.NVarChar, deviceNamePattern || null)
    .input("reason", sql.NVarChar, reason)
    .input("userId", sql.Int, admin.userId)
    .query(`
      INSERT INTO UsbDevicePolicies (Action, VendorId, ProductId, SerialNumber, DeviceNamePattern, Reason, CreatedByUserId)
      VALUES (@action, @vendorId, @productId, @serialNumber, @deviceNamePattern, @reason, @userId)
    `);

  const label = [
    vendorId && `VID ${vendorId}`,
    productId && `PID ${productId}`,
    serialNumber && `serial ${serialNumber}`,
    deviceNamePattern,
  ]
    .filter(Boolean)
    .join(", ");
  const enforced = action === "Block";
  await logAdminAction({
    admin,
    section: "usb-control",
    action: action === "Block" ? "usb_block_add" : "usb_allow_add",
    details: `${label}${reason ? ` (${reason})` : ""}${enforced ? " [enforced on Windows endpoints]" : " [tracking only, not enforced]"}`,
    req,
  });

  return NextResponse.json({
    ok: true,
    note: enforced
      ? "Windows endpoints will apply this on their next heartbeat (up to ~30s). Linux endpoints do not enforce USB policy."
      : "This entry is tracked for visibility only - there's no default-deny mode for it to override yet.",
  });
}

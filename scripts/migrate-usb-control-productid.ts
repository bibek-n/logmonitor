import "dotenv/config";
import { getDb } from "../src/lib/db";

// Adds ProductId (PID) alongside the existing VendorId (VID) capture - needed for real
// enforcement: Windows' Device Installation Restriction policy (DenyDeviceIDs) matches on the
// full "USB\VID_xxxx&PID_yyyy" device ID string, not vendor alone. Added as a follow-up
// migration rather than baked into the original tables since both DeviceUsbEvents
// (migrate-endpointagents-phase2.ts) and UsbDevicePolicies (migrate-usb-control.ts) predate
// this - see agent/usb_windows.go's new pidRe extraction.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceUsbEvents') AND name = 'ProductId')
    ALTER TABLE DeviceUsbEvents ADD ProductId VARCHAR(20) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('UsbDevicePolicies') AND name = 'ProductId')
    ALTER TABLE UsbDevicePolicies ADD ProductId VARCHAR(20) NULL
  `;

  console.log("USB ProductId columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

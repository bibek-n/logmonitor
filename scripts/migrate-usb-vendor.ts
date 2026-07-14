import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // Resolved company name for the device's VID (e.g. "Alcor Micro" for VID 058F) - see
  // agent/usb_windows.go's usbVendorNames map. Windows' own PnP Manufacturer field is
  // usually a generic driver-class placeholder, not the actual vendor, so this is
  // computed agent-side rather than read from an existing column.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceUsbEvents') AND name = 'VendorName')
    ALTER TABLE DeviceUsbEvents ADD VendorName NVARCHAR(150) NULL
  `;

  console.log("DeviceUsbEvents.VendorName ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

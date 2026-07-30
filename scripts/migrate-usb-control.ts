import "dotenv/config";
import { getDb } from "../src/lib/db";

// USB Device Control - Block/Allow policy list. Same "record intent, not enforcement" design
// as SecurityIpBlocklist/SecurityIpAllowlist (migrate-intrusion-detection.ts): the agent does
// not currently read or enforce this table at all (see api/agent/usb-event/route.ts's comment -
// USB detection today is audit-only). This gives admins a place to declare policy and see it
// tracked/audited now, without pretending real-time enforcement exists until an agent change
// ships to actually apply it (e.g. via Windows Device Installation Restriction policies).
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UsbDevicePolicies' AND xtype='U')
    CREATE TABLE UsbDevicePolicies (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Action VARCHAR(10) NOT NULL,
      VendorId VARCHAR(20) NULL,
      SerialNumber NVARCHAR(100) NULL,
      DeviceNamePattern NVARCHAR(200) NULL,
      Reason NVARCHAR(500) NULL,
      CreatedByUserId INT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      IsActive BIT NOT NULL DEFAULT 1,
      CONSTRAINT CK_UsbDevicePolicies_Action CHECK (Action IN ('Block','Allow'))
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_UsbDevicePolicies_Action_Active')
    CREATE INDEX IX_UsbDevicePolicies_Action_Active ON UsbDevicePolicies (Action, IsActive)
  `;

  console.log("USB Device Control schema ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

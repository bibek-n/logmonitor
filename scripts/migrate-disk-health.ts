import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // Physical-disk health/temperature (per-disk, refreshed alongside the rest of
  // DeviceDisks - see agent/hardware.go's applyWindowsDiskHealth).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceDisks') AND name = 'HealthStatus')
    ALTER TABLE DeviceDisks ADD HealthStatus NVARCHAR(50) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceDisks') AND name = 'OperationalStatus')
    ALTER TABLE DeviceDisks ADD OperationalStatus NVARCHAR(100) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceDisks') AND name = 'TemperatureCelsius')
    ALTER TABLE DeviceDisks ADD TemperatureCelsius FLOAT NULL
  `;

  // Live free/total space for the fullest volume, sent every heartbeat alongside the
  // existing DiskPct (see agent/metrics.go) - lets the dashboard show actual GB free and
  // power a "low disk space" alert with a real number, not just a percentage.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceMetrics') AND name = 'DiskFreeGB')
    ALTER TABLE DeviceMetrics ADD DiskFreeGB FLOAT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('DeviceMetrics') AND name = 'DiskTotalGB')
    ALTER TABLE DeviceMetrics ADD DiskTotalGB FLOAT NULL
  `;

  // Unrelated pre-existing bug hit live on a real workstation: some BIOSes report their
  // release date in a long verbose format ("Tuesday, December 2, 2025 5:45:00 PM") rather
  // than the short "MM/DD/YYYY" this column was originally sized for, truncating and
  // throwing a 500 on every hardware upload for that device.
  await db.query`
    ALTER TABLE DeviceHardwareInfo ALTER COLUMN BiosReleaseDate NVARCHAR(100) NULL
  `;

  // Same class of bug, different column: some TPM chips report a padded/verbose version
  // string ("7.2.2.0............."), truncating and throwing a 500 on every security
  // status upload for that device (this is what was blocking the whole Security Posture
  // section from ever populating, not just the TPM field).
  await db.query`
    ALTER TABLE DeviceSecurityStatus ALTER COLUMN TpmVersion NVARCHAR(100) NULL
  `;

  console.log("Disk health columns ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

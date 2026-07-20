import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NvrDevices' AND xtype='U')
    CREATE TABLE NvrDevices (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL,
      IpAddress NVARCHAR(45) NOT NULL,
      Port INT NOT NULL DEFAULT 80,
      Username NVARCHAR(100) NOT NULL,
      Password NVARCHAR(500) NOT NULL,
      OnvifPath NVARCHAR(200) NOT NULL DEFAULT '/onvif/device_service',
      Status NVARCHAR(20) NOT NULL DEFAULT 'Unknown',
      LastSyncedAt DATETIME2 NULL,
      LastError NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='NvrCameras' AND xtype='U')
    CREATE TABLE NvrCameras (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      NvrId INT NOT NULL,
      ProfileToken NVARCHAR(200) NOT NULL,
      ChannelName NVARCHAR(150) NOT NULL,
      SnapshotUri NVARCHAR(1000) NULL,
      StreamUri NVARCHAR(1000) NULL,
      Status NVARCHAR(20) NOT NULL DEFAULT 'Unknown',
      LastSeenAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_NvrCameras_NvrDevices FOREIGN KEY (NvrId) REFERENCES NvrDevices(Id) ON DELETE CASCADE,
      CONSTRAINT UQ_NvrCameras_NvrId_ProfileToken UNIQUE (NvrId, ProfileToken)
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_NvrCameras_NvrId')
    CREATE INDEX IX_NvrCameras_NvrId ON NvrCameras(NvrId)
  `;

  // RTSP is a separate port/protocol from the ONVIF SOAP port (e.g. this Dahua-OEM NVR uses
  // ONVIF on :800 but RTSP on the industry-standard :554)  -  needed for the live-view feature,
  // which streams RTSP directly rather than going through ONVIF's GetStreamUri (see
  // src/lib/onvif.ts's getStreamUri comment for why that response isn't trustworthy here).
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrDevices') AND name = 'RtspPort')
    ALTER TABLE NvrDevices ADD RtspPort INT NOT NULL DEFAULT 554
  `;

  // Parsed from the ONVIF profile name at sync time (e.g. "MediaProfile_Channel1_MainStream"
  // -> 1) so the live-view feature can build a RTSP URL without re-parsing names later.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrCameras') AND name = 'ChannelNumber')
    ALTER TABLE NvrCameras ADD ChannelNumber INT NULL
  `;

  // Some NVRs (confirmed live on this Dahua-OEM unit) authenticate RTSP against the main
  // admin account rather than the dedicated ONVIF account used for the SOAP/snapshot side -
  // NULL here means "same as Username/Password" (the common case), only set these when a
  // device genuinely needs different RTSP credentials.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrDevices') AND name = 'RtspUsername')
    ALTER TABLE NvrDevices ADD RtspUsername NVARCHAR(100) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrDevices') AND name = 'RtspPassword')
    ALTER TABLE NvrDevices ADD RtspPassword NVARCHAR(500) NULL
  `;

  // Admin-editable friendly name/location per camera (e.g. "Front Door" / "Warehouse") -
  // NULL falls back to the raw ONVIF ChannelName in the UI.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrCameras') AND name = 'Label')
    ALTER TABLE NvrCameras ADD Label NVARCHAR(150) NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrCameras') AND name = 'Location')
    ALTER TABLE NvrCameras ADD Location NVARCHAR(150) NULL
  `;

  // User-controlled display order in the camera grid (drag-and-drop) - defaults to 0 for
  // every existing row, which sorts them by ChannelName as a stable tiebreaker until the
  // admin actually reorders something.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrCameras') AND name = 'SortOrder')
    ALTER TABLE NvrCameras ADD SortOrder INT NOT NULL DEFAULT 0
  `;

  console.log("NVR/camera tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

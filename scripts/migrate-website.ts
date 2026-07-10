import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SliderImages' AND xtype='U')
    CREATE TABLE SliderImages (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Title NVARCHAR(200) NULL,
      Subtitle NVARCHAR(500) NULL,
      ButtonText NVARCHAR(100) NULL,
      ButtonUrl NVARCHAR(500) NULL,
      ImagePath NVARCHAR(500) NOT NULL,
      SortOrder INT NOT NULL DEFAULT 0,
      Enabled BIT NOT NULL DEFAULT 1,
      PublishStartAt DATETIME2 NULL,
      PublishEndAt DATETIME2 NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SupportTickets' AND xtype='U')
    CREATE TABLE SupportTickets (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      TicketNumber VARCHAR(20) NOT NULL UNIQUE,
      Name NVARCHAR(200) NOT NULL,
      Email NVARCHAR(200) NOT NULL,
      Subject NVARCHAR(300) NOT NULL,
      Category NVARCHAR(50) NOT NULL,
      Priority VARCHAR(20) NOT NULL,
      Description NVARCHAR(MAX) NOT NULL,
      AttachmentPath NVARCHAR(500) NULL,
      AttachmentOriginalName NVARCHAR(300) NULL,
      Status VARCHAR(20) NOT NULL DEFAULT 'open',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_SupportTickets_Status')
    CREATE INDEX IX_SupportTickets_Status ON SupportTickets (Status, CreatedAt DESC)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SupportTicketNotes' AND xtype='U')
    CREATE TABLE SupportTicketNotes (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      TicketId INT NOT NULL,
      AuthorUserId INT NULL,
      Message NVARCHAR(MAX) NOT NULL,
      IsInternal BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_SupportTicketNotes_Tickets FOREIGN KEY (TicketId) REFERENCES SupportTickets(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ContactMessages' AND xtype='U')
    CREATE TABLE ContactMessages (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(200) NOT NULL,
      Email NVARCHAR(200) NOT NULL,
      Phone VARCHAR(50) NULL,
      Subject NVARCHAR(300) NULL,
      Message NVARCHAR(MAX) NOT NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      ReadAt DATETIME2 NULL
    )
  `;

  const slideCountResult = await db.query`SELECT COUNT(*) AS Cnt FROM SliderImages`;
  if (slideCountResult.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO SliderImages (Title, Subtitle, ButtonText, ButtonUrl, ImagePath, SortOrder, Enabled)
      VALUES (
        'Complete Security, Network & Staff Monitoring',
        'Real-time visibility into your security posture, network health, hardware assets, and staff activity — all in one platform.',
        'Learn More',
        '/about-software',
        '/uploads/slider/demo-slide.svg',
        0,
        1
      )
    `;
    console.log("Seeded a demo slider image — manage/replace it from Dashboard > Website > Slider Management.");
  }

  console.log("Website tables (SliderImages, SupportTickets, SupportTicketNotes, ContactMessages) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

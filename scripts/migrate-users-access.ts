import "dotenv/config";
import { getDb } from "../src/lib/db";

// Extends the existing `Users` table additively — never touches the `Role` column's
// semantics, since `src/lib/requireAdmin.ts`'s resolveAdminSession() checks it directly.
async function addColumnIfMissing(db: Awaited<ReturnType<typeof getDb>>, table: string, column: string, definition: string) {
  await db.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('${table}') AND name = '${column}')
    ALTER TABLE ${table} ADD ${column} ${definition}
  `);
}

async function main() {
  const db = await getDb();

  await addColumnIfMissing(db, "Users", "Email", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "Users", "FullName", "NVARCHAR(200) NULL");
  await addColumnIfMissing(db, "Users", "DepartmentId", "INT NULL");
  await addColumnIfMissing(db, "Users", "TeamId", "INT NULL");
  await addColumnIfMissing(db, "Users", "BranchOfficeId", "INT NULL");
  await addColumnIfMissing(db, "Users", "JobDesignationId", "INT NULL");
  await addColumnIfMissing(db, "Users", "RoleId", "INT NULL");
  await addColumnIfMissing(db, "Users", "IsActive", "BIT NOT NULL DEFAULT 1");
  await addColumnIfMissing(db, "Users", "MfaRequired", "BIT NOT NULL DEFAULT 0");
  await addColumnIfMissing(db, "Users", "MfaEnrolledAt", "DATETIME2 NULL");

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Roles' AND xtype='U')
    CREATE TABLE Roles (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(100) NOT NULL UNIQUE,
      Description NVARCHAR(300) NULL,
      IsSystem BIT NOT NULL DEFAULT 0,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  const roleCount = await db.query`SELECT COUNT(*) AS Cnt FROM Roles`;
  if (roleCount.recordset[0].Cnt === 0) {
    await db.query`
      INSERT INTO Roles (Name, Description, IsSystem) VALUES
        ('Admin', 'Full administrative access.', 1),
        ('Employee', 'Standard employee account, no admin access.', 1)
    `;
    console.log("Seeded default Roles (Admin, Employee).");
  }

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RolePermissions' AND xtype='U')
    CREATE TABLE RolePermissions (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      RoleId INT NOT NULL,
      PermissionKey NVARCHAR(100) NOT NULL,
      Allowed BIT NOT NULL DEFAULT 0,
      CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES Roles(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserGroups' AND xtype='U')
    CREATE TABLE UserGroups (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(150) NOT NULL,
      Description NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='UserGroupMembers' AND xtype='U')
    CREATE TABLE UserGroupMembers (
      UserId INT NOT NULL,
      GroupId INT NOT NULL,
      PRIMARY KEY (UserId, GroupId),
      CONSTRAINT FK_UserGroupMembers_Users FOREIGN KEY (UserId) REFERENCES Users(Id),
      CONSTRAINT FK_UserGroupMembers_Groups FOREIGN KEY (GroupId) REFERENCES UserGroups(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='LoginActivity' AND xtype='U')
    CREATE TABLE LoginActivity (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      UserId INT NULL,
      Username NVARCHAR(100) NOT NULL,
      IpAddress NVARCHAR(100) NULL,
      UserAgent NVARCHAR(500) NULL,
      Success BIT NOT NULL,
      FailureReason NVARCHAR(200) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_LoginActivity_CreatedAt')
    CREATE INDEX IX_LoginActivity_CreatedAt ON LoginActivity (CreatedAt DESC)
  `;

  console.log("Users & Access tables (Users columns, Roles, RolePermissions, UserGroups, UserGroupMembers, LoginActivity) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

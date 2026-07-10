import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Departments' AND xtype='U')
    CREATE TABLE Departments (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(150) NOT NULL,
      Description NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Teams' AND xtype='U')
    CREATE TABLE Teams (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(150) NOT NULL,
      DepartmentId INT NULL,
      Description NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      CONSTRAINT FK_Teams_Departments FOREIGN KEY (DepartmentId) REFERENCES Departments(Id)
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BranchOffices' AND xtype='U')
    CREATE TABLE BranchOffices (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Name NVARCHAR(150) NOT NULL,
      Address NVARCHAR(300) NULL,
      City NVARCHAR(100) NULL,
      Country NVARCHAR(100) NULL,
      Phone NVARCHAR(50) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='JobDesignations' AND xtype='U')
    CREATE TABLE JobDesignations (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Title NVARCHAR(150) NOT NULL,
      Description NVARCHAR(500) NULL,
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
      UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  console.log("Organization structure tables (Departments, Teams, BranchOffices, JobDesignations) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

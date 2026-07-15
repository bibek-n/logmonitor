import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();

  // The organization structure tables (Departments/Teams/BranchOffices/JobDesignations -
  // see migrate-org-structure.ts) were never actually linked to Staff, so the employee edit
  // form had no way to pick from them - Department/Position stayed free-text fields, and
  // Team/Branch Office didn't exist on Staff at all. Adding FK columns rather than replacing
  // the existing Department/Position NVARCHAR columns outright - the PATCH route mirrors the
  // selected name/title into those legacy columns too, so anything elsewhere in the app
  // still reading Staff.Department/Position as plain text keeps working unchanged.
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'DepartmentId')
    ALTER TABLE Staff ADD DepartmentId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Staff_Departments')
    ALTER TABLE Staff ADD CONSTRAINT FK_Staff_Departments FOREIGN KEY (DepartmentId) REFERENCES Departments(Id)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'TeamId')
    ALTER TABLE Staff ADD TeamId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Staff_Teams')
    ALTER TABLE Staff ADD CONSTRAINT FK_Staff_Teams FOREIGN KEY (TeamId) REFERENCES Teams(Id)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'BranchOfficeId')
    ALTER TABLE Staff ADD BranchOfficeId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Staff_BranchOffices')
    ALTER TABLE Staff ADD CONSTRAINT FK_Staff_BranchOffices FOREIGN KEY (BranchOfficeId) REFERENCES BranchOffices(Id)
  `;

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Staff') AND name = 'JobDesignationId')
    ALTER TABLE Staff ADD JobDesignationId INT NULL
  `;
  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Staff_JobDesignations')
    ALTER TABLE Staff ADD CONSTRAINT FK_Staff_JobDesignations FOREIGN KEY (JobDesignationId) REFERENCES JobDesignations(Id)
  `;

  console.log("Staff org-structure link columns (DepartmentId/TeamId/BranchOfficeId/JobDesignationId) ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

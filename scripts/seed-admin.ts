import "dotenv/config";
import bcrypt from "bcryptjs";
import { getDb, sql } from "../src/lib/db";

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("ADMIN_PASSWORD environment variable is required (no hardcoded default — set it in .env before running this script).");
    process.exit(1);
  }

  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
    CREATE TABLE Users (
      Id INT IDENTITY(1,1) PRIMARY KEY,
      Username NVARCHAR(100) NOT NULL UNIQUE,
      PasswordHash NVARCHAR(255) NOT NULL,
      Role NVARCHAR(50) NOT NULL DEFAULT 'Admin',
      CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    )
  `;

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await db
    .request()
    .input("username", sql.NVarChar, username)
    .query("SELECT Id FROM Users WHERE Username = @username");

  if (existing.recordset.length > 0) {
    await db
      .request()
      .input("username", sql.NVarChar, username)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .query(
        "UPDATE Users SET PasswordHash = @passwordHash, Role = 'Admin' WHERE Username = @username"
      );
    console.log(`Updated existing admin user '${username}'.`);
  } else {
    await db
      .request()
      .input("username", sql.NVarChar, username)
      .input("passwordHash", sql.NVarChar, passwordHash)
      .query(
        "INSERT INTO Users (Username, PasswordHash, Role) VALUES (@username, @passwordHash, 'Admin')"
      );
    console.log(`Created admin user '${username}'.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

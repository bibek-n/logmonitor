import webpush from "web-push";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  await db.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PushSettings')
    BEGIN
      CREATE TABLE PushSettings (
        Id INT PRIMARY KEY CHECK (Id = 1),
        VapidPublicKey NVARCHAR(200) NOT NULL,
        VapidPrivateKey NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      )
    END
  `);
  await db.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PushSubscriptions')
    BEGIN
      CREATE TABLE PushSubscriptions (
        Id INT IDENTITY PRIMARY KEY,
        UserId INT NOT NULL,
        Endpoint NVARCHAR(1000) NOT NULL,
        P256dh NVARCHAR(500) NOT NULL,
        Auth NVARCHAR(500) NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_PushSubscriptions_Endpoint UNIQUE (Endpoint)
      )
    END
  `);

  const existing = await db.query<{ Id: number }>("SELECT Id FROM PushSettings WHERE Id = 1");
  if (existing.recordset.length === 0) {
    const keys = webpush.generateVAPIDKeys();
    await db
      .request()
      .input("publicKey", keys.publicKey)
      .input("privateKey", keys.privateKey)
      .query("INSERT INTO PushSettings (Id, VapidPublicKey, VapidPrivateKey) VALUES (1, @publicKey, @privateKey)");
    console.log("Generated and stored new VAPID keypair.");
  } else {
    console.log("VAPID keypair already exists, left unchanged.");
  }

  console.log("PushSettings / PushSubscriptions tables ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

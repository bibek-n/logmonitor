import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const result = await db.query("SELECT @@SERVERNAME AS server, DB_NAME() AS db, SYSTEM_USER AS whoami");
  console.log("CONNECTED:", result.recordset[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error("CONNECTION FAILED:", err.message);
  process.exit(1);
});

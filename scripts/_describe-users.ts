import "dotenv/config";
import { getDb } from "../src/lib/db";

async function main() {
  const db = await getDb();
  const result = await db.query`
    SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Users'
    ORDER BY ORDINAL_POSITION
  `;
  for (const row of result.recordset as { COLUMN_NAME: string; IS_NULLABLE: string; COLUMN_DEFAULT: string | null; DATA_TYPE: string }[]) {
    console.log(`${row.COLUMN_NAME}\t${row.DATA_TYPE}\tnullable=${row.IS_NULLABLE}\tdefault=${row.COLUMN_DEFAULT ?? "-"}`);
  }
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

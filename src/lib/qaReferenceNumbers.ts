import { getDb, sql } from "./db";

// No existing code in this app uses a real SQL transaction (every migrate-*.ts / route.ts
// checked during Phase 1 research does single, independent statements) — this is new
// infrastructure, introduced because generating a unique, gap-tolerant reference number
// (TC-00042 / TR-00007 / BUG-00019) safely under concurrent requests genuinely needs one:
// computing MAX(...)+1 and inserting in two separate statements would let two simultaneous
// requests compute the same "next" number. WITH (UPDLOCK, HOLDLOCK) on the SELECT forces a
// second concurrent caller to wait for the first transaction to commit or roll back before
// it can even read the current MAX, which is what actually prevents the duplicate.
//
// `table`/`column`/`prefix` are always literal constants passed by this module's own route
// code, never user input, so string-interpolating them into the SQL text is safe (no
// injection surface) — the same trust boundary this app's migrate-*.ts scripts already rely
// on for static DDL identifiers.
export async function withReferenceNumber<T>(
  table: string,
  column: string,
  prefix: string,
  insertFn: (transaction: InstanceType<typeof sql.Transaction>, referenceNumber: string) => Promise<T>
): Promise<T> {
  const db = await getDb();
  const transaction = new sql.Transaction(db);
  await transaction.begin();
  try {
    const request = new sql.Request(transaction);
    const result = await request.query<{ MaxNum: number | null }>(`
      SELECT MAX(CAST(SUBSTRING(${column}, ${prefix.length + 2}, 10) AS INT)) AS MaxNum
      FROM ${table} WITH (UPDLOCK, HOLDLOCK)
      WHERE ${column} LIKE '${prefix}-%'
    `);
    const next = (result.recordset[0]?.MaxNum ?? 0) + 1;
    const referenceNumber = `${prefix}-${String(next).padStart(5, "0")}`;

    const returned = await insertFn(transaction, referenceNumber);
    await transaction.commit();
    return returned;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

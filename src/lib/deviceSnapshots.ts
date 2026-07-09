import { getDb, sql } from "./db";

// Shared upsert for the three JSON-blob "latest state" snapshot tables (processes,
// services, software) — process/service/software lists are enumerable current state,
// not time series, so each device has exactly one row, replaced wholesale each refresh.
// table/jsonColumn are always fixed literals from our own route code, never
// request-derived, so string interpolation into the query text here is safe.
export async function upsertSnapshot(table: string, jsonColumn: string, deviceId: string, jsonValue: unknown) {
  const db = await getDb();
  const json = JSON.stringify(jsonValue ?? []);

  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .query(`SELECT 1 FROM ${table} WHERE DeviceId = @deviceId`);

  if (existing.recordset.length > 0) {
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("json", sql.NVarChar(sql.MAX), json)
      .query(`UPDATE ${table} SET ${jsonColumn} = @json, UpdatedAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId`);
  } else {
    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("json", sql.NVarChar(sql.MAX), json)
      .query(`INSERT INTO ${table} (DeviceId, ${jsonColumn}) VALUES (@deviceId, @json)`);
  }
}

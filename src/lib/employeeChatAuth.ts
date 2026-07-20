import { getDb, sql } from "./db";

export interface DeviceChatRow {
  Id: number;
  StaffId: number;
  StaffName: string;
}

// Shared by the public chat API route and the employee-facing chat page — a bad/missing
// token or a device with no linked Staff record both resolve to null, so a wrong token
// can't be used to probe for which device IDs exist.
export async function resolveDeviceChat(deviceId: string, token: string | null): Promise<DeviceChatRow | null> {
  if (!token) return null;
  const db = await getDb();
  const result = await db
    .request()
    .input("deviceId", sql.VarChar, deviceId)
    .input("token", sql.NVarChar, token)
    .query<{ Id: number; StaffId: number | null; StaffName: string | null }>(`
      SELECT d.Id, d.StaffId, s.Name AS StaffName
      FROM Devices d
      LEFT JOIN Staff s ON s.Id = d.StaffId
      WHERE d.DeviceId = @deviceId AND d.ChatToken = @token
    `);
  const row = result.recordset[0];
  if (!row || !row.StaffId || !row.StaffName) return null;
  return { Id: row.Id, StaffId: row.StaffId, StaffName: row.StaffName };
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const VALID_CHANGE_TYPES = new Set(["Baseline", "Modified", "Deleted", "Created"]);
// A watched file could be anything - a multi-MB log file included by mistake, a binary - so the
// captured before/after content is capped agent-side (see agent/fileintegrity.go) and capped
// again here defensively, independent of whatever the agent sends.
const MAX_VALUE_LENGTH = 50000;

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const body = await req.json().catch(() => null);
  const filePath = typeof body?.filePath === "string" ? body.filePath.trim() : "";
  const changeType = typeof body?.changeType === "string" ? body.changeType : "";
  const modifiedBy = typeof body?.modifiedBy === "string" && body.modifiedBy ? body.modifiedBy : null;
  const oldHash = typeof body?.oldHash === "string" && body.oldHash ? body.oldHash : null;
  const newHash = typeof body?.newHash === "string" && body.newHash ? body.newHash : null;
  const oldValue = typeof body?.oldValue === "string" ? body.oldValue.slice(0, MAX_VALUE_LENGTH) : null;
  const newValue = typeof body?.newValue === "string" ? body.newValue.slice(0, MAX_VALUE_LENGTH) : null;

  if (!filePath || !VALID_CHANGE_TYPES.has(changeType)) {
    return NextResponse.json({ ok: false, error: "filePath and a valid changeType are required" });
  }

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("filePath", sql.NVarChar, filePath)
    .input("changeType", sql.VarChar, changeType)
    .input("modifiedBy", sql.NVarChar, modifiedBy)
    .input("oldHash", sql.VarChar, oldHash)
    .input("newHash", sql.VarChar, newHash)
    .input("oldValue", sql.NVarChar, oldValue)
    .input("newValue", sql.NVarChar, newValue)
    .query(`
      INSERT INTO FileIntegrityEvents (DeviceId, FilePath, ChangeType, ModifiedBy, OldHash, NewHash, OldValue, NewValue)
      VALUES (@deviceId, @filePath, @changeType, @modifiedBy, @oldHash, @newHash, @oldValue, @newValue)
    `);

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const VALID_SOURCES = new Set(["apache_access", "apache_error", "mysql", "php", "system"]);
const MAX_BATCH = 500;

interface LogEntryInput {
  source: string;
  timestamp?: string;
  message?: string;
  raw?: string;
  severity?: string;
}

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entries: LogEntryInput[] = Array.isArray(body?.entries) ? body.entries : [];
  if (entries.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const db = await getDb();
  let inserted = 0;
  for (const entry of entries.slice(0, MAX_BATCH)) {
    if (!VALID_SOURCES.has(entry.source)) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("logTimestamp", sql.DateTime2, entry.timestamp ?? null)
      .input("logSource", sql.VarChar, entry.source)
      .input("severity", sql.VarChar, entry.severity ?? null)
      .input("message", sql.NVarChar, entry.message ?? null)
      .input("rawLine", sql.NVarChar, entry.raw ?? null)
      .query(
        "INSERT INTO ServerLogEntries (DeviceId, LogTimestamp, LogSource, Severity, Message, RawLine) VALUES (@deviceId, @logTimestamp, @logSource, @severity, @message, @rawLine)"
      );
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}

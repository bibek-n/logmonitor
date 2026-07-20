import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const VALID_SOURCES = new Set(["apache_access", "apache_error", "nginx_access", "nginx_error", "mysql", "php", "system", "eventlog", "mssql", "mssql_slow"]);
// Raised from the original 500: a busy nginx install ships one default access/error log PLUS
// one pair per virtual host (confirmed live: 60+ vhosts on one box - see
// agent/logs.go's collectNginxVhostLogs), each capped at 500 lines/cycle on the agent side.
// At 500 total, a single busy default log could fill the whole batch and silently starve
// every other source/vhost for that cycle (entries.slice below just drops the rest) - 500 was
// sized for a single Apache/nginx pair, not a multi-vhost box.
const MAX_BATCH = 4000;

interface LogEntryInput {
  source: string;
  timestamp?: string;
  message?: string;
  raw?: string;
  severity?: string;
  // Which nginx virtual host this entry came from - nginx (unlike Apache's one fixed
  // access/error log) commonly logs every vhost to its own file (see agent/logs.go's
  // collectNginxVhostLogs), so LogSource stays the same small fixed enum and this column
  // carries which site. Null/omitted for the default nginx log and for every non-nginx source.
  siteName?: string;
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
      .input("siteName", sql.NVarChar, typeof entry.siteName === "string" && entry.siteName ? entry.siteName.slice(0, 200) : null)
      .query(
        "INSERT INTO ServerLogEntries (DeviceId, LogTimestamp, LogSource, Severity, Message, RawLine, SiteName) VALUES (@deviceId, @logTimestamp, @logSource, @severity, @message, @rawLine, @siteName)"
      );
    inserted++;
  }

  return NextResponse.json({ ok: true, inserted });
}

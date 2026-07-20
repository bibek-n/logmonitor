import { readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { join } from "node:path";
import type { AdapterResult } from "./types";
import type { LogSourceRow } from "../store";

// IIS's own default field order when a site has never had its logging fields customized -
// used only as a fallback if a read window never happens to include the file's own
// `#Fields:` header (e.g. resuming mid-file on a restart). Whenever the header IS seen, it
// always wins over this default.
const IIS_DEFAULT_FIELDS = [
  "date", "time", "s-ip", "cs-method", "cs-uri-stem", "cs-uri-query", "s-port",
  "cs-username", "c-ip", "cs(User-Agent)", "cs(Referer)", "sc-status", "sc-substatus", "sc-win32-status", "time-taken",
];

interface IisAdapterConfig {
  logDirectory: string;
  filePattern?: string; // regex source, defaults to IIS's own u_ex*.log naming
}

function pickCurrentLogFile(config: IisAdapterConfig): { path: string; size: number } | null {
  let entries: string[];
  try {
    entries = readdirSync(config.logDirectory);
  } catch {
    return null; // Directory not present on this box - adapter disables itself gracefully.
  }
  const pattern = new RegExp(config.filePattern ?? "^u_ex\\d{6}(_x)?\\.log$", "i");
  const candidates = entries.filter((f) => pattern.test(f));
  if (candidates.length === 0) return null;

  let newest: { path: string; size: number; mtime: number } | null = null;
  for (const name of candidates) {
    const full = join(config.logDirectory, name);
    const stat = statSync(full);
    if (!newest || stat.mtimeMs > newest.mtime) {
      newest = { path: full, size: stat.size, mtime: stat.mtimeMs };
    }
  }
  return newest ? { path: newest.path, size: newest.size } : null;
}

function parseFieldsHeader(line: string): string[] | null {
  if (!line.startsWith("#Fields:")) return null;
  return line.slice("#Fields:".length).trim().split(/\s+/);
}

function buildEventTime(record: Record<string, string>): string {
  const date = record["date"];
  const time = record["time"];
  if (date && time) {
    const iso = `${date}T${time}Z`;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

// Incrementally tails the current IIS W3C extended access log: resumes from the stored byte
// offset, detects rotation (a new file appeared, or the tracked file shrank/vanished) by
// comparing file identity + size rather than re-reading from scratch, and only ever emits
// complete lines - a line straddling the end of this read window is left unconsumed so the
// next run picks it up whole from the correct byte offset.
export async function collectIisAccessLog(logSource: LogSourceRow): Promise<AdapterResult> {
  // mssql/tedious returns BIGINT columns as strings (to avoid precision loss beyond
  // Number.MAX_SAFE_INTEGER) even though the TS type says number - coerce at the boundary.
  const lastPosition = Number(logSource.LastPosition);
  const lastFileSize = logSource.LastFileSize === null ? null : Number(logSource.LastFileSize);

  const config: IisAdapterConfig = JSON.parse(logSource.ConfigJson || "{}");
  if (!config.logDirectory) {
    return { events: [], newPosition: lastPosition };
  }

  const current = pickCurrentLogFile(config);
  if (!current) {
    // Directory/matching file not present - this is exactly the "unavailable tools can be
    // disabled without breaking the application" case; return no events, don't error.
    return { events: [], newPosition: lastPosition };
  }

  const isSameFile = logSource.LastPositionFile === current.path;
  const rotated = !isSameFile || (lastFileSize !== null && current.size < lastFileSize);
  const startPosition = rotated ? 0 : lastPosition;

  if (current.size <= startPosition) {
    // Nothing new since last run.
    return { events: [], newPosition: startPosition, newFileSize: current.size, newPositionFile: current.path };
  }

  const bytesToRead = current.size - startPosition;
  const buffer = Buffer.alloc(bytesToRead);
  const fd = openSync(current.path, "r");
  let bytesRead = 0;
  try {
    bytesRead = readSync(fd, buffer, 0, bytesToRead, startPosition);
  } finally {
    closeSync(fd);
  }

  const text = buffer.toString("utf8", 0, bytesRead);
  const lastNewlineIndex = text.lastIndexOf("\n");
  // Only process up through the last complete line - anything after stays unread until the
  // next run, when it'll be part of a complete line.
  const completeText = lastNewlineIndex === -1 ? "" : text.slice(0, lastNewlineIndex);
  const consumedBytes = lastNewlineIndex === -1 ? 0 : Buffer.byteLength(text.slice(0, lastNewlineIndex + 1), "utf8");

  let fields = IIS_DEFAULT_FIELDS;
  const events: ReturnType<typeof mapLine>[] = [];

  for (const line of completeText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("#")) {
      const parsedFields = parseFieldsHeader(trimmed);
      if (parsedFields) fields = parsedFields;
      continue;
    }
    const mapped = mapLine(trimmed, fields, logSource);
    if (mapped) events.push(mapped);
  }

  return {
    events: events.filter((e): e is NonNullable<typeof e> => e !== null),
    newPosition: startPosition + consumedBytes,
    newFileSize: current.size,
    newPositionFile: current.path,
  };
}

function mapLine(line: string, fields: string[], logSource: LogSourceRow) {
  const values = line.split(" ");
  if (values.length < 3) return null;
  const record: Record<string, string> = {};
  fields.forEach((field, i) => {
    record[field] = values[i] ?? "-";
  });

  const clean = (v: string | undefined): string | null => (!v || v === "-" ? null : v);
  const userAgentRaw = clean(record["cs(User-Agent)"]);

  return {
    logSourceId: logSource.Id,
    protectedApplicationId: logSource.ProtectedApplicationId,
    dataSource: "iis_access_log" as const,
    eventTime: buildEventTime(record),
    sourceIp: clean(record["c-ip"]),
    destinationHost: clean(record["s-ip"]),
    requestMethod: clean(record["cs-method"]),
    requestPath: (() => {
      const stem = clean(record["cs-uri-stem"]) ?? "";
      const query = clean(record["cs-uri-query"]);
      return query ? `${stem}?${query}` : stem || null;
    })(),
    responseStatus: record["sc-status"] ? Number(record["sc-status"]) : null,
    userAgent: userAgentRaw ? userAgentRaw.replace(/\+/g, " ") : null,
    userAccount: clean(record["cs-username"]),
    evidenceSummary: line,
    fields: {
      timeTaken: record["time-taken"] ? Number(record["time-taken"]) : null,
      scSubstatus: record["sc-substatus"] ?? null,
      referer: clean(record["cs(Referer)"]),
    },
  };
}

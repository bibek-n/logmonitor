export interface ParsedWebFilterLog {
  logDate: string | null;
  logTime: string | null;
  deviceName: string | null;
  srcIp: string | null;
  dstIp: string | null;
  srcPort: number | null;
  dstPort: number | null;
  protocol: string | null;
  httpMethod: string | null;
  url: string | null;
  domain: string | null;
  category: string | null;
  categoryType: string | null;
  action: string | null;
  userName: string | null;
  logType: string | null;
  logComponent: string | null;
  logSubtype: string | null;
  application: string | null;
  applicationCategory: string | null;
  bytesSent: number | null;
  bytesReceived: number | null;
}

const KV_REGEX = /(\w+)=(?:"([^"]*)"|(\S*))/g;

export function extractFields(raw: string): Record<string, string> {
  const dateIdx = raw.indexOf("date=");
  const body = dateIdx >= 0 ? raw.slice(dateIdx) : raw;

  const fields: Record<string, string> = {};
  let match: RegExpExecArray | null;
  KV_REGEX.lastIndex = 0;
  while ((match = KV_REGEX.exec(body)) !== null) {
    const key = match[1];
    const value = match[2] !== undefined ? match[2] : match[3] ?? "";
    fields[key] = value;
  }
  return fields;
}

export function parseSophosLog(raw: string): ParsedWebFilterLog {
  const fields = extractFields(raw);

  const toInt = (v: string | undefined): number | null => {
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? null : n;
  };

  // date=/time= don't exist on this firewall's current firmware (XGS126) - it only sends a
  // combined timestamp="2026-07-21T16:01:59+0545" field. Falls back to splitting that, same
  // pattern already used by handleSystemHealth in syslog/listener.ts for the same reason.
  let logDate: string | null = fields.date ?? null;
  let logTime: string | null = fields.time ?? null;
  if (!logDate && fields.timestamp) {
    const [d, t] = fields.timestamp.split("T");
    logDate = d ?? null;
    logTime = t ? t.replace(/[+-]\d{4}$/, "") : null;
  }

  return {
    logDate,
    logTime,
    deviceName: fields.device_name ?? null,
    srcIp: fields.src_ip ?? null,
    dstIp: fields.dst_ip ?? null,
    srcPort: toInt(fields.src_port),
    dstPort: toInt(fields.dst_port),
    protocol: fields.protocol ?? null,
    httpMethod: fields.httpmethod ?? null,
    url: fields.url ?? null,
    // Confirmed live against real RawMessage samples from this exact firewall (XGS126,
    // current firmware): the actual keys are `domain=`/`http_category=`/`http_category_type=`,
    // not `domainname=`/`category=`/`category_type=` - the old key names meant these three
    // columns were silently null on effectively every row ever ingested. Old keys kept as a
    // fallback in case a different firmware version or log profile ever uses them.
    domain: fields.domain ?? fields.domainname ?? null,
    category: fields.http_category ?? fields.category ?? null,
    categoryType: fields.http_category_type ?? fields.category_type ?? null,
    action: fields.action ?? fields.status ?? null,
    userName: fields.user_name ?? null,
    logType: fields.log_type ?? null,
    logComponent: fields.log_component ?? null,
    logSubtype: fields.log_subtype ?? null,
    // Sophos's own per-connection Application Control identification (e.g. "Youtube Website",
    // "WhatsApp") - much more granular than http_category, and only present on some rows
    // (app_name is populated once Sophos's App Control engine has classified that specific
    // flow - many rows, especially short-lived ones, never get an app_name at all).
    application: fields.app_name ?? null,
    applicationCategory: fields.app_category ?? null,
    bytesSent: toInt(fields.bytes_sent),
    bytesReceived: toInt(fields.bytes_received),
  };
}

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

  return {
    logDate: fields.date ?? null,
    logTime: fields.time ?? null,
    deviceName: fields.device_name ?? null,
    srcIp: fields.src_ip ?? null,
    dstIp: fields.dst_ip ?? null,
    srcPort: toInt(fields.src_port),
    dstPort: toInt(fields.dst_port),
    protocol: fields.protocol ?? null,
    httpMethod: fields.httpmethod ?? null,
    url: fields.url ?? null,
    domain: fields.domainname ?? null,
    category: fields.category ?? null,
    categoryType: fields.category_type ?? null,
    action: fields.action ?? fields.status ?? null,
    userName: fields.user_name ?? null,
    logType: fields.log_type ?? null,
    logComponent: fields.log_component ?? null,
    logSubtype: fields.log_subtype ?? null,
  };
}

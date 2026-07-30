// Minimal JSONPath-like resolver - no existing implementation/dependency for this anywhere in
// the app (confirmed by search). Deliberately not a full JSONPath grammar (no wildcards,
// filters, recursive descent, or slices) - just what a monitoring assertion actually needs:
// dot-separated object keys and bracket array indices/quoted keys, with an optional leading
// "$." exactly like the examples users are used to from Postman/other API tools.
//   "$.data.items[0].id"  ->  ["data", "items", "0", "id"]
//   "status"               ->  ["status"]
//   "items[0]['name']"     ->  ["items", "0", "name"]
export function resolveJsonPath(data: unknown, path: string): unknown {
  const cleaned = path.trim().replace(/^\$\.?/, "");
  if (!cleaned) return data;

  const normalized = cleaned.replace(/\[(['"])(.*?)\1\]/g, ".$2").replace(/\[(\d+)\]/g, ".$1");
  const segments = normalized.split(".").filter(Boolean);

  let current: unknown = data;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

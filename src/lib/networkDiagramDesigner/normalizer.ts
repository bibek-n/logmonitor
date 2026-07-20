import { networkDiagramDataSchema } from "./schema";
import { createEmptyDiagram } from "./defaultDiagram";
import type { NetworkDiagramData } from "./types";

// Defensive parsing for whatever is actually stored in a NetworkDiagramDesigns.DiagramJson
// row — malformed data, a future schemaVersion bump, or (in principle) hand-edited rows.
// This is scoped entirely to the NEW table's own format; it never reads from or converts the
// legacy NetworkDiagrams.DiagramJson (custom DiagramDoc shape) — the legacy diagram is only
// ever read through its own existing endpoint/page, unchanged, exactly as required.
export function normalizeDiagramData(raw: unknown): NetworkDiagramData {
  const parsed = networkDiagramDataSchema.safeParse(raw);
  if (parsed.success) return parsed.data;

  // Unknown/invalid shape (or an unsupported schemaVersion, since the schema pins
  // schemaVersion to CURRENT_SCHEMA_VERSION via z.literal) — fail safe to an empty diagram
  // rather than throwing, so a single corrupted row can't take down the whole list/detail view.
  return createEmptyDiagram();
}

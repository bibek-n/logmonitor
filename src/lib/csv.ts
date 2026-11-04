// Hand-rolled CSV parse/serialize â€” no CSV library is installed anywhere in this app
// (confirmed: package.json has no papaparse/csv-parse), and the one existing CSV-adjacent
// precedent (scripts/import-oui.ts) hand-rolls its own line parser rather than adding a
// dependency. This follows the same zero-new-dependency approach, extended to also handle
// serialization (export) and multi-line quoted fields (import).

// Minimal RFC 4180-ish parser: handles quoted fields, embedded commas, embedded newlines
// (inside quotes), and doubled-quote escaping ("" -> ").
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // skip â€” paired \n handles the row break
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // CSV/formula injection: Excel/Sheets treats a cell starting with =, +, -, or @ as a
  // formula when the file is opened, regardless of this being a plain CSV export - a
  // free-text field containing attacker- or user-influenced content (e.g. a staff note, an
  // imported hostname) could execute as a live formula for whoever opens the export. Prefix
  // with a single quote, the standard OWASP-recommended mitigation: Excel/Sheets then render
  // the value as literal text, and the leading quote is invisible in the cell display (it's a
  // text-coercion marker, not real content, same convention Excel itself uses for this).
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

// Turns a header row + data rows into an array of { header: value } objects, trimming
// whitespace and tolerating a byte-order-mark on the first header (common from Excel exports).
export function csvRowsToRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.replace(/^ï»¿/, "").trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (row[i] ?? "").trim();
    });
    return record;
  });
}


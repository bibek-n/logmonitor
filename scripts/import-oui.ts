import "dotenv/config";
import fs from "fs";
import path from "path";
import { getDb, sql } from "../src/lib/db";

// Minimal CSV line parser handling quoted fields with embedded commas.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

async function main() {
  const csvPath = path.join(__dirname, "..", "oui-raw.csv");
  const content = fs.readFileSync(csvPath, "utf8");
  const lines = content.split("\n").filter(Boolean);

  // The raw registry has a handful of duplicate prefixes (re-registrations); keep the
  // last occurrence, which is fine since we only need a reasonable vendor label.
  const dedup = new Map<string, string>();
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const [registry, assignment, orgName] = fields;
    if (registry !== "MA-L") continue;
    if (!assignment || assignment.length !== 6) continue;
    dedup.set(assignment.toUpperCase(), orgName ?? "");
  }

  const db = await getDb();
  await db.query`TRUNCATE TABLE OuiVendors`;

  const entries = [...dedup.entries()];
  let total = 0;
  for (let i = 0; i < entries.length; i += 1000) {
    const chunk = entries.slice(i, i + 1000);
    const table = new sql.Table("OuiVendors");
    table.create = false;
    table.columns.add("Prefix", sql.VarChar(6), { nullable: false });
    table.columns.add("VendorName", sql.NVarChar(300), { nullable: false });
    for (const [prefix, vendor] of chunk) {
      table.rows.add(prefix, vendor);
    }
    const request = db.request();
    await request.bulk(table);
    total += chunk.length;
  }

  console.log(`Imported ${total} unique OUI vendor entries.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

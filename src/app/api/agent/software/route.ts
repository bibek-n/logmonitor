import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";
import { upsertSnapshot } from "@/lib/deviceSnapshots";
import { raiseAlertIfNew } from "@/lib/deviceAlerts";

interface SoftwareEntry {
  name?: string;
}

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.software)) {
    return NextResponse.json({ ok: false, error: "Expected { software: [...] }" }, { status: 400 });
  }

  // Diff against the previous snapshot (if one exists) to flag newly-installed
  // software — skipped on the very first-ever scan, since every entry would otherwise
  // look "new" and flood the alert log.
  const db = await getDb();
  const previous = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query<{ SoftwareJson: string }>("SELECT SoftwareJson FROM DeviceSoftwareSnapshot WHERE DeviceId = @deviceId");

  if (previous.recordset[0]) {
    try {
      const prevNames = new Set(
        (JSON.parse(previous.recordset[0].SoftwareJson) as SoftwareEntry[]).map((s) => s.name).filter(Boolean)
      );
      for (const entry of body.software as SoftwareEntry[]) {
        if (entry.name && !prevNames.has(entry.name)) {
          await raiseAlertIfNew(device.deviceId, `new_software_${entry.name}`, "info", `New software installed: ${entry.name}`);
        }
      }
    } catch {
      // malformed previous snapshot — skip the diff for this cycle, not fatal
    }
  }

  await upsertSnapshot("DeviceSoftwareSnapshot", "SoftwareJson", device.deviceId, body.software);

  return NextResponse.json({ ok: true });
}

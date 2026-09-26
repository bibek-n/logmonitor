import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

const bodySchema = z.object({ ids: z.array(z.number().int().positive()).max(100) });

// Called by a Wake-on-LAN relay agent AFTER it has sent the magic packets (execute-then-ack,
// the opposite of power-action-ack - a lost ack just means a harmless duplicate packet, while
// acking first could silently drop a wake request). Scoped to RelayDeviceId so a device can
// only ever fulfil requests that were actually assigned to it. Always responds 200 - see
// src/app/api/agent/enroll/route.ts for why.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid body" });
  }
  if (parsed.data.ids.length === 0) return NextResponse.json({ ok: true });

  const db = await getDb();
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query(
      `UPDATE PendingWakeRequests SET FulfilledAt = SYSUTCDATETIME() WHERE RelayDeviceId = @deviceId AND FulfilledAt IS NULL AND Id IN (${parsed.data.ids.join(",")})`
    );

  return NextResponse.json({ ok: true });
}

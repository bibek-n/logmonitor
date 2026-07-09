import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";
import { encryptScreenshot, saveScreenshotFile, watermarkAndCompress } from "@/lib/screenshotStorage";

const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024; // generous ceiling for a single full-res PNG/JPEG

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (device.privacyMode) {
    return NextResponse.json({ ok: false, error: "Privacy mode is enabled for this device" }, { status: 403 });
  }

  const capturedBy = req.headers.get("x-captured-by") === "interval" ? "interval" : "manual";
  const capturedAtHeader = req.headers.get("x-captured-at");
  const capturedAt = capturedAtHeader && !Number.isNaN(Date.parse(capturedAtHeader)) ? new Date(capturedAtHeader) : new Date();
  const currentUser = req.headers.get("x-current-user") || null;
  const ip = clientIp(req);

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    return NextResponse.json({ ok: false, error: "Empty body" }, { status: 400 });
  }
  if (arrayBuffer.byteLength > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ ok: false, error: "Screenshot too large" }, { status: 413 });
  }

  const rawBytes = Buffer.from(arrayBuffer);

  let processed;
  try {
    processed = await watermarkAndCompress(rawBytes, {
      hostname: device.hostname,
      currentUser,
      ip,
      capturedAt,
      capturedBy,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `Image processing failed: ${err instanceof Error ? err.message : "unknown"}` }, { status: 400 });
  }

  const encrypted = encryptScreenshot(processed.bytes);
  const filePath = await saveScreenshotFile(device.deviceId, encrypted);

  const db = await getDb();

  let requestedByUserId: number | null = null;
  if (capturedBy === "manual") {
    const pendingResult = await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .query<{ Id: number; RequestedByUserId: number }>(`
        SELECT TOP 1 Id, RequestedByUserId FROM PendingScreenshotRequests
        WHERE DeviceId = @deviceId AND FulfilledAt IS NULL
        ORDER BY RequestedAt ASC
      `);
    const pending = pendingResult.recordset[0];
    if (pending) {
      requestedByUserId = pending.RequestedByUserId;
      await db.request().input("id", sql.Int, pending.Id).query(
        "UPDATE PendingScreenshotRequests SET FulfilledAt = SYSUTCDATETIME() WHERE Id = @id"
      );
    }
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("capturedAt", sql.DateTime2, capturedAt)
    .input("filePath", sql.NVarChar, filePath)
    .input("fileSizeBytes", sql.BigInt, encrypted.length)
    .input("width", sql.Int, processed.width)
    .input("height", sql.Int, processed.height)
    .input("format", sql.VarChar, processed.format)
    .input("capturedBy", sql.VarChar, capturedBy)
    .input("requestedByUserId", sql.Int, requestedByUserId)
    .query(`
      INSERT INTO Screenshots (DeviceId, CapturedAt, FilePath, FileSizeBytes, Width, Height, Format, CapturedBy, RequestedByUserId)
      VALUES (@deviceId, @capturedAt, @filePath, @fileSizeBytes, @width, @height, @format, @capturedBy, @requestedByUserId)
    `);

  return NextResponse.json({ ok: true });
}

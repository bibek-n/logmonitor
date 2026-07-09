import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query("SELECT 1 FROM DeviceHardwareInfo WHERE DeviceId = @deviceId");

  const request = db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("cpuModel", sql.NVarChar, body.cpuModel ?? null)
    .input("cpuManufacturer", sql.NVarChar, body.cpuManufacturer ?? null)
    .input("cpuCores", sql.Int, body.cpuCores ?? null)
    .input("cpuThreads", sql.Int, body.cpuThreads ?? null)
    .input("cpuClockMhz", sql.Float, body.cpuClockMhz ?? null)
    .input("memoryTotalMB", sql.BigInt, body.memoryTotalMB ?? null)
    .input("diskModel", sql.NVarChar, body.diskModel ?? null)
    .input("diskType", sql.VarChar, body.diskType ?? null)
    .input("diskCapacityGB", sql.Float, body.diskCapacityGB ?? null)
    .input("gpuName", sql.NVarChar, body.gpuName ?? null)
    .input("osEdition", sql.NVarChar, body.osEdition ?? null)
    .input("osBuild", sql.NVarChar, body.osBuild ?? null)
    .input("kernelVersion", sql.NVarChar, body.kernelVersion ?? null)
    .input("architecture", sql.VarChar, body.architecture ?? null);

  if (existing.recordset.length > 0) {
    await request.query(`
      UPDATE DeviceHardwareInfo SET
        CpuModel = @cpuModel, CpuManufacturer = @cpuManufacturer, CpuCores = @cpuCores,
        CpuThreads = @cpuThreads, CpuClockMhz = @cpuClockMhz, MemoryTotalMB = @memoryTotalMB,
        DiskModel = @diskModel, DiskType = @diskType, DiskCapacityGB = @diskCapacityGB,
        GpuName = @gpuName, OsEdition = @osEdition, OsBuild = @osBuild,
        KernelVersion = @kernelVersion, Architecture = @architecture, UpdatedAt = SYSUTCDATETIME()
      WHERE DeviceId = @deviceId
    `);
  } else {
    await request.query(`
      INSERT INTO DeviceHardwareInfo
        (DeviceId, CpuModel, CpuManufacturer, CpuCores, CpuThreads, CpuClockMhz, MemoryTotalMB,
         DiskModel, DiskType, DiskCapacityGB, GpuName, OsEdition, OsBuild, KernelVersion, Architecture)
      VALUES
        (@deviceId, @cpuModel, @cpuManufacturer, @cpuCores, @cpuThreads, @cpuClockMhz, @memoryTotalMB,
         @diskModel, @diskType, @diskCapacityGB, @gpuName, @osEdition, @osBuild, @kernelVersion, @architecture)
    `);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

interface DiskInput {
  index: number;
  model?: string;
  type?: string;
  capacityGB?: number;
  healthStatus?: string;
  operationalStatus?: string;
  temperatureCelsius?: number;
}

interface InterfaceInput {
  name?: string;
  macAddress?: string;
  ipAddresses?: string[];
  isUp?: boolean;
  speedMbps?: number;
}

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
    .input("architecture", sql.VarChar, body.architecture ?? null)
    .input("motherboardManufacturer", sql.NVarChar, body.motherboardManufacturer ?? null)
    .input("motherboardModel", sql.NVarChar, body.motherboardModel ?? null)
    .input("biosManufacturer", sql.NVarChar, body.biosManufacturer ?? null)
    .input("biosReleaseDate", sql.NVarChar, body.biosReleaseDate ?? null);

  if (existing.recordset.length > 0) {
    await request.query(`
      UPDATE DeviceHardwareInfo SET
        CpuModel = @cpuModel, CpuManufacturer = @cpuManufacturer, CpuCores = @cpuCores,
        CpuThreads = @cpuThreads, CpuClockMhz = @cpuClockMhz, MemoryTotalMB = @memoryTotalMB,
        DiskModel = @diskModel, DiskType = @diskType, DiskCapacityGB = @diskCapacityGB,
        GpuName = @gpuName, OsEdition = @osEdition, OsBuild = @osBuild,
        KernelVersion = @kernelVersion, Architecture = @architecture,
        MotherboardManufacturer = @motherboardManufacturer, MotherboardModel = @motherboardModel,
        BiosManufacturer = @biosManufacturer, BiosReleaseDate = @biosReleaseDate,
        UpdatedAt = SYSUTCDATETIME()
      WHERE DeviceId = @deviceId
    `);
  } else {
    await request.query(`
      INSERT INTO DeviceHardwareInfo
        (DeviceId, CpuModel, CpuManufacturer, CpuCores, CpuThreads, CpuClockMhz, MemoryTotalMB,
         DiskModel, DiskType, DiskCapacityGB, GpuName, OsEdition, OsBuild, KernelVersion, Architecture,
         MotherboardManufacturer, MotherboardModel, BiosManufacturer, BiosReleaseDate)
      VALUES
        (@deviceId, @cpuModel, @cpuManufacturer, @cpuCores, @cpuThreads, @cpuClockMhz, @memoryTotalMB,
         @diskModel, @diskType, @diskCapacityGB, @gpuName, @osEdition, @osBuild, @kernelVersion, @architecture,
         @motherboardManufacturer, @motherboardModel, @biosManufacturer, @biosReleaseDate)
    `);
  }

  // Keep the identity fields on Devices itself fresh too (these columns existed since
  // Phase 2 but were never actually populated by any route until now).
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("manufacturer", sql.NVarChar, body.systemManufacturer ?? null)
    .input("model", sql.NVarChar, body.systemModel ?? null)
    .input("serialNumber", sql.NVarChar, body.serialNumber ?? null)
    .input("biosVersion", sql.NVarChar, body.biosVersion ?? null)
    .input("motherboardSerial", sql.NVarChar, body.motherboardSerial ?? null)
    .query(`
      UPDATE Devices SET
        Manufacturer = COALESCE(@manufacturer, Manufacturer),
        Model = COALESCE(@model, Model),
        SerialNumber = COALESCE(@serialNumber, SerialNumber),
        BiosVersion = COALESCE(@biosVersion, BiosVersion),
        MotherboardSerial = COALESCE(@motherboardSerial, MotherboardSerial)
      WHERE DeviceId = @deviceId
    `);

  // Multi-disk / multi-interface snapshots: delete-then-insert, same pattern as the
  // existing process/service/software snapshot upserts.
  const disks: DiskInput[] = Array.isArray(body.disks) ? body.disks : [];
  if (disks.length > 0) {
    await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM DeviceDisks WHERE DeviceId = @deviceId");
    for (const disk of disks) {
      await db
        .request()
        .input("deviceId", sql.VarChar, device.deviceId)
        .input("diskIndex", sql.Int, disk.index ?? 0)
        .input("model", sql.NVarChar, disk.model ?? null)
        .input("type", sql.VarChar, disk.type ?? null)
        .input("capacityGB", sql.Float, disk.capacityGB ?? null)
        .input("healthStatus", sql.NVarChar, disk.healthStatus || null)
        .input("operationalStatus", sql.NVarChar, disk.operationalStatus || null)
        .input("temperatureCelsius", sql.Float, typeof disk.temperatureCelsius === "number" ? disk.temperatureCelsius : null)
        .query(
          "INSERT INTO DeviceDisks (DeviceId, DiskIndex, Model, Type, CapacityGB, HealthStatus, OperationalStatus, TemperatureCelsius) VALUES (@deviceId, @diskIndex, @model, @type, @capacityGB, @healthStatus, @operationalStatus, @temperatureCelsius)"
        );
    }
  }

  const interfaces: InterfaceInput[] = Array.isArray(body.interfaces) ? body.interfaces : [];
  if (interfaces.length > 0) {
    await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM DeviceNetworkInterfaces WHERE DeviceId = @deviceId");
    for (const iface of interfaces) {
      await db
        .request()
        .input("deviceId", sql.VarChar, device.deviceId)
        .input("name", sql.NVarChar, iface.name ?? null)
        .input("macAddress", sql.VarChar, iface.macAddress ?? null)
        .input("ipAddresses", sql.NVarChar, Array.isArray(iface.ipAddresses) ? iface.ipAddresses.join(", ") : null)
        .input("isUp", sql.Bit, iface.isUp ?? null)
        .input("speedMbps", sql.Int, iface.speedMbps ?? null)
        .query(
          "INSERT INTO DeviceNetworkInterfaces (DeviceId, InterfaceName, MacAddress, IpAddresses, IsUp, SpeedMbps) VALUES (@deviceId, @name, @macAddress, @ipAddresses, @isUp, @speedMbps)"
        );
    }
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

interface AppPoolPayload {
  Name?: string;
  State?: string;
}
interface WorkerProcessPayload {
  ProcessId?: number;
  AppPoolName?: string;
  CpuPercent?: number | null;
  PrivateBytesMB?: number | null;
}
interface SitePayload {
  Name?: string;
  State?: string;
  Bindings?: string;
  StatusCode?: number | null;
  ResponseTimeMs?: number | null;
  IsAvailable?: boolean;
  SslExpiresAt?: string | null;
}

// Posted every iisInterval (2m) by the agent, only on devices where IisDetected() found
// appcmd.exe - a plain Windows Server agent with no IIS role never calls this route. App
// pools/worker processes/sites are all "what does it look like right now" snapshots
// (delete-then-insert), same pattern as DeviceDisks; the aggregate perf counters are the one
// piece that's genuinely time-series (append), same pattern as DeviceMetrics.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const detected = body.detected === true;
  const appPools: AppPoolPayload[] = Array.isArray(body.appPools) ? body.appPools : [];
  const sites: SitePayload[] = Array.isArray(body.sites) ? body.sites : [];
  const workerProcesses: WorkerProcessPayload[] = Array.isArray(body.workerProcesses) ? body.workerProcesses : [];
  const webServiceRequestsPerSec = typeof body.webServiceRequestsPerSec === "number" ? body.webServiceRequestsPerSec : null;
  const currentConnections = typeof body.currentConnections === "number" ? Math.round(body.currentConnections) : null;
  const aspNetRequestsPerSec = typeof body.aspNetRequestsPerSec === "number" ? body.aspNetRequestsPerSec : null;
  const failedRequestTraceCount = typeof body.failedRequestTraceCount === "number" ? Math.round(body.failedRequestTraceCount) : null;

  const db = await getDb();

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("detected", sql.Bit, detected)
    .query("UPDATE Devices SET IisDetected = @detected, LastIisCheckAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId");

  if (!detected) {
    return NextResponse.json({ ok: true });
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM IisAppPools WHERE DeviceId = @deviceId");
  for (const p of appPools) {
    if (!p.Name) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("name", sql.NVarChar, p.Name)
      .input("state", sql.VarChar, p.State ?? "Unknown")
      .query("INSERT INTO IisAppPools (DeviceId, Name, State) VALUES (@deviceId, @name, @state)");
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM IisWorkerProcesses WHERE DeviceId = @deviceId");
  for (const w of workerProcesses) {
    if (typeof w.ProcessId !== "number") continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("processId", sql.Int, w.ProcessId)
      .input("appPoolName", sql.NVarChar, w.AppPoolName ?? null)
      .input("privateBytesMB", sql.Float, w.PrivateBytesMB ?? null)
      .input("cpuPercent", sql.Float, w.CpuPercent ?? null)
      .query(`
        INSERT INTO IisWorkerProcesses (DeviceId, ProcessId, AppPoolName, PrivateBytesMB, CpuPercent)
        VALUES (@deviceId, @processId, @appPoolName, @privateBytesMB, @cpuPercent)
      `);
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM IisSites WHERE DeviceId = @deviceId");
  for (const s of sites) {
    if (!s.Name) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("siteName", sql.NVarChar, s.Name)
      .input("state", sql.VarChar, s.State ?? "Unknown")
      .input("bindings", sql.NVarChar, s.Bindings ?? null)
      .input("isAvailable", sql.Bit, s.IsAvailable === true)
      .input("statusCode", sql.Int, typeof s.StatusCode === "number" ? s.StatusCode : null)
      .input("responseTimeMs", sql.Float, typeof s.ResponseTimeMs === "number" ? s.ResponseTimeMs : null)
      .input("sslExpiresAt", sql.DateTime2, s.SslExpiresAt ? new Date(s.SslExpiresAt) : null)
      .query(`
        INSERT INTO IisSites (DeviceId, SiteName, State, Bindings, IsAvailable, LastStatusCode, LastResponseTimeMs, SslExpiresAt)
        VALUES (@deviceId, @siteName, @state, @bindings, @isAvailable, @statusCode, @responseTimeMs, @sslExpiresAt)
      `);
  }

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("webServiceRequestsPerSec", sql.Float, webServiceRequestsPerSec)
    .input("currentConnections", sql.Int, currentConnections)
    .input("aspNetRequestsPerSec", sql.Float, aspNetRequestsPerSec)
    .input("failedRequestTraceCount", sql.Int, failedRequestTraceCount)
    .query(`
      INSERT INTO IisPerfSnapshots (DeviceId, WebServiceRequestsPerSec, CurrentConnections, AspNetRequestsPerSec, FailedRequestTraceCount)
      VALUES (@deviceId, @webServiceRequestsPerSec, @currentConnections, @aspNetRequestsPerSec, @failedRequestTraceCount)
    `);

  return NextResponse.json({ ok: true });
}

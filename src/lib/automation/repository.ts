import { getDb, sql } from "../db";
import {
  AutomationDeviceSummary,
  AutomationJob,
  AutomationJobTarget,
  AutomationJobTargetStatus,
  AutomationSchedule,
  AutomationScript,
  AutomationTriggerType,
  PendingAutomationJobPayload,
} from "./types";
import type { z } from "zod";
import type { createScheduleSchema, createScriptSchema, updateScheduleSchema, updateScriptSchema } from "./schema";

function mapScript(r: {
  Id: number;
  Name: string;
  Description: string | null;
  PowerShellBody: string | null;
  BashBody: string | null;
  TimeoutSeconds: number;
  CreatedByUserId: number | null;
  CreatedAt: Date;
  UpdatedByUserId: number | null;
  UpdatedAt: Date;
}): AutomationScript {
  return {
    id: r.Id,
    name: r.Name,
    description: r.Description,
    powerShellBody: r.PowerShellBody,
    bashBody: r.BashBody,
    timeoutSeconds: r.TimeoutSeconds,
    createdByUserId: r.CreatedByUserId,
    createdAt: r.CreatedAt,
    updatedByUserId: r.UpdatedByUserId,
    updatedAt: r.UpdatedAt,
  };
}

export async function listScripts(): Promise<AutomationScript[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Description: string | null;
    PowerShellBody: string | null;
    BashBody: string | null;
    TimeoutSeconds: number;
    CreatedByUserId: number | null;
    CreatedAt: Date;
    UpdatedByUserId: number | null;
    UpdatedAt: Date;
  }>(
    "SELECT Id, Name, Description, PowerShellBody, BashBody, TimeoutSeconds, CreatedByUserId, CreatedAt, UpdatedByUserId, UpdatedAt FROM AutomationScripts WHERE IsDeleted = 0 ORDER BY Name ASC"
  );
  return result.recordset.map(mapScript);
}

export async function getScript(id: number): Promise<AutomationScript | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<{
      Id: number;
      Name: string;
      Description: string | null;
      PowerShellBody: string | null;
      BashBody: string | null;
      TimeoutSeconds: number;
      CreatedByUserId: number | null;
      CreatedAt: Date;
      UpdatedByUserId: number | null;
      UpdatedAt: Date;
    }>(
      "SELECT Id, Name, Description, PowerShellBody, BashBody, TimeoutSeconds, CreatedByUserId, CreatedAt, UpdatedByUserId, UpdatedAt FROM AutomationScripts WHERE Id = @id AND IsDeleted = 0"
    );
  const row = result.recordset[0];
  return row ? mapScript(row) : null;
}

export async function createScript(input: z.infer<typeof createScriptSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("description", sql.NVarChar, input.description ?? null)
    .input("powerShellBody", sql.NVarChar(sql.MAX), input.powerShellBody ?? null)
    .input("bashBody", sql.NVarChar(sql.MAX), input.bashBody ?? null)
    .input("timeoutSeconds", sql.Int, input.timeoutSeconds)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO AutomationScripts (Name, Description, PowerShellBody, BashBody, TimeoutSeconds, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@name, @description, @powerShellBody, @bashBody, @timeoutSeconds, @userId, @userId)
    `);
  return result.recordset[0].Id;
}

export async function updateScript(id: number, input: z.infer<typeof updateScriptSchema>, userId: number): Promise<void> {
  const db = await getDb();
  const existing = await getScript(id);
  if (!existing) throw new Error("Script not found");

  const merged = {
    name: input.name ?? existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    powerShellBody: input.powerShellBody !== undefined ? input.powerShellBody : existing.powerShellBody,
    bashBody: input.bashBody !== undefined ? input.bashBody : existing.bashBody,
    timeoutSeconds: input.timeoutSeconds ?? existing.timeoutSeconds,
  };
  if (!merged.powerShellBody?.trim() && !merged.bashBody?.trim()) {
    throw new Error("A script must keep at least a PowerShell or Bash body.");
  }

  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, merged.name)
    .input("description", sql.NVarChar, merged.description)
    .input("powerShellBody", sql.NVarChar(sql.MAX), merged.powerShellBody)
    .input("bashBody", sql.NVarChar(sql.MAX), merged.bashBody)
    .input("timeoutSeconds", sql.Int, merged.timeoutSeconds)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE AutomationScripts
      SET Name = @name, Description = @description, PowerShellBody = @powerShellBody, BashBody = @bashBody,
        TimeoutSeconds = @timeoutSeconds, UpdatedByUserId = @userId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
}

export async function deleteScript(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE AutomationScripts SET IsDeleted = 1 WHERE Id = @id");
}

// Server AND Workstation - same target set as Malware Detection's on-demand scan (neither
// feature is gated by DeviceType; a developer's endpoint PC is exactly as valid a target as a
// production server). Only devices that have completed enrollment (have a real ApiKeyHash) can
// ever pick up a job, but nothing here filters on that - an unenrolled row can't exist in
// Devices in the first place.
export async function listEligibleDevices(): Promise<AutomationDeviceSummary[]> {
  const db = await getDb();
  const result = await db.query<{ DeviceId: string; DeviceName: string | null; Hostname: string; DeviceType: string; OS: string }>(`
    SELECT DeviceId, DeviceName, Hostname, DeviceType, OS FROM Devices
    WHERE DeviceType IN ('Server', 'Workstation')
    ORDER BY DeviceName ASC, Hostname ASC
  `);
  return result.recordset.map((r) => ({
    deviceId: r.DeviceId,
    deviceName: r.DeviceName,
    hostname: r.Hostname,
    deviceType: r.DeviceType,
    os: r.OS,
  }));
}

// Queues one AutomationJob targeting every listed device - both script bodies are snapshotted
// onto the job as-is (whichever the script had at this exact moment); which body a given
// device actually runs is resolved per-target, at heartbeat time, from that device's own OS
// (see the heartbeat route) - never decided here, since a job can legitimately span a mixed
// Windows+Linux fleet in one click.
export async function createJob(opts: {
  scriptId: number;
  scriptNameSnapshot: string;
  powerShellBodySnapshot: string | null;
  bashBodySnapshot: string | null;
  timeoutSeconds: number;
  triggerType: AutomationTriggerType;
  scheduleId: number | null;
  requestedByUserId: number | null;
  deviceIds: string[];
}): Promise<number> {
  const db = await getDb();
  const jobResult = await db
    .request()
    .input("scriptId", sql.Int, opts.scriptId)
    .input("scriptNameSnapshot", sql.NVarChar, opts.scriptNameSnapshot)
    .input("powerShellBodySnapshot", sql.NVarChar(sql.MAX), opts.powerShellBodySnapshot)
    .input("bashBodySnapshot", sql.NVarChar(sql.MAX), opts.bashBodySnapshot)
    .input("timeoutSeconds", sql.Int, opts.timeoutSeconds)
    .input("triggerType", sql.VarChar, opts.triggerType)
    .input("scheduleId", sql.Int, opts.scheduleId)
    .input("requestedByUserId", sql.Int, opts.requestedByUserId)
    .query<{ Id: number }>(`
      INSERT INTO AutomationJobs (ScriptId, ScriptNameSnapshot, PowerShellBodySnapshot, BashBodySnapshot, TimeoutSeconds, TriggerType, ScheduleId, RequestedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@scriptId, @scriptNameSnapshot, @powerShellBodySnapshot, @bashBodySnapshot, @timeoutSeconds, @triggerType, @scheduleId, @requestedByUserId)
    `);
  const jobId = jobResult.recordset[0].Id;

  for (const deviceId of opts.deviceIds) {
    await db
      .request()
      .input("jobId", sql.Int, jobId)
      .input("deviceId", sql.VarChar, deviceId)
      .query("INSERT INTO AutomationJobTargets (JobId, DeviceId) VALUES (@jobId, @deviceId)");
  }

  return jobId;
}

function mapTarget(r: {
  Id: number;
  JobId: number;
  DeviceId: string;
  DeviceName: string | null;
  Hostname: string;
  OS: string;
  Status: AutomationJobTargetStatus;
  ExitCode: number | null;
  Stdout: string | null;
  Stderr: string | null;
  ErrorMessage: string | null;
  StartedAt: Date | null;
  CompletedAt: Date | null;
}): AutomationJobTarget {
  return {
    id: r.Id,
    jobId: r.JobId,
    deviceId: r.DeviceId,
    deviceName: r.DeviceName,
    hostname: r.Hostname,
    os: r.OS,
    status: r.Status,
    exitCode: r.ExitCode,
    stdout: r.Stdout,
    stderr: r.Stderr,
    errorMessage: r.ErrorMessage,
    startedAt: r.StartedAt,
    completedAt: r.CompletedAt,
  };
}

const TARGET_SELECT = `
  SELECT ajt.Id, ajt.JobId, ajt.DeviceId, d.DeviceName, d.Hostname, d.OS, ajt.Status, ajt.ExitCode,
    ajt.Stdout, ajt.Stderr, ajt.ErrorMessage, ajt.StartedAt, ajt.CompletedAt
  FROM AutomationJobTargets ajt
  JOIN Devices d ON d.DeviceId = ajt.DeviceId
`;

export async function listJobs(limit: number = 100): Promise<AutomationJob[]> {
  const db = await getDb();
  const jobsResult = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<{
      Id: number;
      ScriptId: number | null;
      ScriptNameSnapshot: string;
      TimeoutSeconds: number;
      TriggerType: AutomationTriggerType;
      ScheduleId: number | null;
      RequestedByUserId: number | null;
      CreatedAt: Date;
    }>(`
      SELECT TOP (@limit) Id, ScriptId, ScriptNameSnapshot, TimeoutSeconds, TriggerType, ScheduleId, RequestedByUserId, CreatedAt
      FROM AutomationJobs ORDER BY CreatedAt DESC
    `);
  if (jobsResult.recordset.length === 0) return [];

  const jobIds = jobsResult.recordset.map((j) => j.Id);
  const targetsResult = await db.query<{
    Id: number;
    JobId: number;
    DeviceId: string;
    DeviceName: string | null;
    Hostname: string;
    OS: string;
    Status: AutomationJobTargetStatus;
    ExitCode: number | null;
    Stdout: string | null;
    Stderr: string | null;
    ErrorMessage: string | null;
    StartedAt: Date | null;
    CompletedAt: Date | null;
  }>(`${TARGET_SELECT} WHERE ajt.JobId IN (${jobIds.join(",")})`);

  const targetsByJob = new Map<number, AutomationJobTarget[]>();
  for (const row of targetsResult.recordset) {
    const mapped = mapTarget(row);
    const list = targetsByJob.get(mapped.jobId) ?? [];
    list.push(mapped);
    targetsByJob.set(mapped.jobId, list);
  }

  return jobsResult.recordset.map((j) => ({
    id: j.Id,
    scriptId: j.ScriptId,
    scriptNameSnapshot: j.ScriptNameSnapshot,
    timeoutSeconds: j.TimeoutSeconds,
    triggerType: j.TriggerType,
    scheduleId: j.ScheduleId,
    requestedByUserId: j.RequestedByUserId,
    createdAt: j.CreatedAt,
    targets: targetsByJob.get(j.Id) ?? [],
  }));
}

export async function getJob(id: number): Promise<AutomationJob | null> {
  const db = await getDb();
  const jobResult = await db
    .request()
    .input("id", sql.Int, id)
    .query<{
      Id: number;
      ScriptId: number | null;
      ScriptNameSnapshot: string;
      TimeoutSeconds: number;
      TriggerType: AutomationTriggerType;
      ScheduleId: number | null;
      RequestedByUserId: number | null;
      CreatedAt: Date;
    }>(
      "SELECT Id, ScriptId, ScriptNameSnapshot, TimeoutSeconds, TriggerType, ScheduleId, RequestedByUserId, CreatedAt FROM AutomationJobs WHERE Id = @id"
    );
  const job = jobResult.recordset[0];
  if (!job) return null;

  const targetsResult = await db.request().input("jobId", sql.Int, id).query<{
    Id: number;
    JobId: number;
    DeviceId: string;
    DeviceName: string | null;
    Hostname: string;
    OS: string;
    Status: AutomationJobTargetStatus;
    ExitCode: number | null;
    Stdout: string | null;
    Stderr: string | null;
    ErrorMessage: string | null;
    StartedAt: Date | null;
    CompletedAt: Date | null;
  }>(`${TARGET_SELECT} WHERE ajt.JobId = @jobId ORDER BY d.DeviceName ASC, d.Hostname ASC`);

  return {
    id: job.Id,
    scriptId: job.ScriptId,
    scriptNameSnapshot: job.ScriptNameSnapshot,
    timeoutSeconds: job.TimeoutSeconds,
    triggerType: job.TriggerType,
    scheduleId: job.ScheduleId,
    requestedByUserId: job.RequestedByUserId,
    createdAt: job.CreatedAt,
    targets: targetsResult.recordset.map(mapTarget),
  };
}

// Called from the agent heartbeat route - resolves each of this device's pending targets to
// the script body matching the device's own OS. A target whose job snapshot has no body for
// this device's OS (e.g. a Linux-only script queued against a Windows box) is immediately
// marked Error rather than left pending forever or silently skipped, so the admin console shows
// exactly why nothing ran instead of a job that hangs with no explanation.
export async function getPendingJobsForDevice(deviceId: string, os: string): Promise<PendingAutomationJobPayload[]> {
  const db = await getDb();
  const result = await db.request().input("deviceId", sql.VarChar, deviceId).query<{
    Id: number;
    JobId: number;
    PowerShellBodySnapshot: string | null;
    BashBodySnapshot: string | null;
    TimeoutSeconds: number;
  }>(`
    SELECT ajt.Id, aj.Id AS JobId, aj.PowerShellBodySnapshot, aj.BashBodySnapshot, aj.TimeoutSeconds
    FROM AutomationJobTargets ajt
    JOIN AutomationJobs aj ON aj.Id = ajt.JobId
    WHERE ajt.DeviceId = @deviceId AND ajt.Status = 'Pending'
  `);

  const payloads: PendingAutomationJobPayload[] = [];
  const missingBodyTargetIds: number[] = [];

  for (const row of result.recordset) {
    const shell: "powershell" | "bash" | null = os === "windows" ? "powershell" : os === "linux" ? "bash" : null;
    const body = shell === "powershell" ? row.PowerShellBodySnapshot : shell === "bash" ? row.BashBodySnapshot : null;
    if (!shell || !body?.trim()) {
      missingBodyTargetIds.push(row.Id);
      continue;
    }
    payloads.push({ requestId: row.Id, jobId: row.JobId, scriptBody: body, shell, timeoutSeconds: row.TimeoutSeconds });
  }

  for (const targetId of missingBodyTargetIds) {
    await db
      .request()
      .input("id", sql.Int, targetId)
      .input("errorMessage", sql.NVarChar, `No script body defined for this device's OS (${os}).`)
      .query(
        "UPDATE AutomationJobTargets SET Status = 'Error', ErrorMessage = @errorMessage, CompletedAt = SYSUTCDATETIME() WHERE Id = @id"
      );
  }

  return payloads;
}

// deviceId scopes the update to the target row actually assigned to this device - without it,
// a compromised agent could report a (guessable, auto-incrementing) requestId belonging to a
// different device's job and overwrite its result. Combined with the Status='Pending' guard,
// only the one row genuinely dispatched to this device can ever be written here.
export async function recordJobResult(
  requestId: number,
  deviceId: string,
  result: { status: AutomationJobTargetStatus; exitCode: number | null; stdout: string; stderr: string; errorMessage: string | null }
): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, requestId)
    .input("deviceId", sql.VarChar, deviceId)
    .input("status", sql.VarChar, result.status)
    .input("exitCode", sql.Int, result.exitCode)
    .input("stdout", sql.NVarChar(sql.MAX), result.stdout)
    .input("stderr", sql.NVarChar(sql.MAX), result.stderr)
    .input("errorMessage", sql.NVarChar, result.errorMessage)
    .query(`
      UPDATE AutomationJobTargets
      SET Status = @status, ExitCode = @exitCode, Stdout = @stdout, Stderr = @stderr, ErrorMessage = @errorMessage,
        CompletedAt = SYSUTCDATETIME()
      WHERE Id = @id AND DeviceId = @deviceId AND Status = 'Pending'
    `);
}

// --- Scheduled Jobs ------------------------------------------------------------------------

function mapSchedule(r: {
  Id: number;
  ScriptId: number;
  ScriptName?: string;
  Name: string;
  IntervalMinutes: number;
  NextRunAt: Date;
  LastRunAt: Date | null;
  IsActive: boolean;
  CreatedAt: Date;
  UpdatedAt: Date;
}): Omit<AutomationSchedule, "targetDeviceIds"> {
  return {
    id: r.Id,
    scriptId: r.ScriptId,
    scriptName: r.ScriptName,
    name: r.Name,
    intervalMinutes: r.IntervalMinutes,
    nextRunAt: r.NextRunAt,
    lastRunAt: r.LastRunAt,
    isActive: r.IsActive,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
  };
}

export async function listSchedules(): Promise<AutomationSchedule[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    ScriptId: number;
    ScriptName: string;
    Name: string;
    IntervalMinutes: number;
    NextRunAt: Date;
    LastRunAt: Date | null;
    IsActive: boolean;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(`
    SELECT s.Id, s.ScriptId, sc.Name AS ScriptName, s.Name, s.IntervalMinutes, s.NextRunAt, s.LastRunAt, s.IsActive, s.CreatedAt, s.UpdatedAt
    FROM AutomationSchedules s JOIN AutomationScripts sc ON sc.Id = s.ScriptId
    WHERE s.IsDeleted = 0 ORDER BY s.Name ASC
  `);
  if (result.recordset.length === 0) return [];

  const scheduleIds = result.recordset.map((r) => r.Id);
  const targetsResult = await db.query<{ AutomationScheduleId: number; DeviceId: string }>(
    `SELECT AutomationScheduleId, DeviceId FROM AutomationScheduleTargets WHERE AutomationScheduleId IN (${scheduleIds.join(",")})`
  );
  const deviceIdsBySchedule = new Map<number, string[]>();
  for (const row of targetsResult.recordset) {
    const list = deviceIdsBySchedule.get(row.AutomationScheduleId) ?? [];
    list.push(row.DeviceId);
    deviceIdsBySchedule.set(row.AutomationScheduleId, list);
  }

  return result.recordset.map((r) => ({ ...mapSchedule(r), targetDeviceIds: deviceIdsBySchedule.get(r.Id) ?? [] }));
}

export async function getSchedule(id: number): Promise<AutomationSchedule | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .query<{
      Id: number;
      ScriptId: number;
      ScriptName: string;
      Name: string;
      IntervalMinutes: number;
      NextRunAt: Date;
      LastRunAt: Date | null;
      IsActive: boolean;
      CreatedAt: Date;
      UpdatedAt: Date;
    }>(`
      SELECT s.Id, s.ScriptId, sc.Name AS ScriptName, s.Name, s.IntervalMinutes, s.NextRunAt, s.LastRunAt, s.IsActive, s.CreatedAt, s.UpdatedAt
      FROM AutomationSchedules s JOIN AutomationScripts sc ON sc.Id = s.ScriptId
      WHERE s.Id = @id AND s.IsDeleted = 0
    `);
  const row = result.recordset[0];
  if (!row) return null;

  const targetsResult = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ DeviceId: string }>("SELECT DeviceId FROM AutomationScheduleTargets WHERE AutomationScheduleId = @id");

  return { ...mapSchedule(row), targetDeviceIds: targetsResult.recordset.map((t) => t.DeviceId) };
}

export async function createSchedule(input: z.infer<typeof createScheduleSchema>, userId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("scriptId", sql.Int, input.scriptId)
    .input("name", sql.NVarChar, input.name)
    .input("intervalMinutes", sql.Int, input.intervalMinutes)
    .input("isActive", sql.Bit, input.isActive)
    .input("userId", sql.Int, userId)
    .query<{ Id: number }>(`
      INSERT INTO AutomationSchedules (ScriptId, Name, IntervalMinutes, NextRunAt, IsActive, CreatedByUserId, UpdatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@scriptId, @name, @intervalMinutes, DATEADD(MINUTE, @intervalMinutes, SYSUTCDATETIME()), @isActive, @userId, @userId)
    `);
  const scheduleId = result.recordset[0].Id;

  for (const deviceId of input.deviceIds) {
    await db
      .request()
      .input("scheduleId", sql.Int, scheduleId)
      .input("deviceId", sql.VarChar, deviceId)
      .query("INSERT INTO AutomationScheduleTargets (AutomationScheduleId, DeviceId) VALUES (@scheduleId, @deviceId)");
  }

  return scheduleId;
}

export async function updateSchedule(id: number, input: z.infer<typeof updateScheduleSchema>, userId: number): Promise<void> {
  const db = await getDb();
  const existing = await getSchedule(id);
  if (!existing) throw new Error("Schedule not found");

  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, input.name ?? existing.name)
    .input("intervalMinutes", sql.Int, input.intervalMinutes ?? existing.intervalMinutes)
    .input("isActive", sql.Bit, input.isActive ?? existing.isActive)
    .input("userId", sql.Int, userId)
    .query(`
      UPDATE AutomationSchedules
      SET Name = @name, IntervalMinutes = @intervalMinutes, IsActive = @isActive, UpdatedByUserId = @userId, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);

  if (input.deviceIds) {
    await db.request().input("id", sql.Int, id).query("DELETE FROM AutomationScheduleTargets WHERE AutomationScheduleId = @id");
    for (const deviceId of input.deviceIds) {
      await db
        .request()
        .input("scheduleId", sql.Int, id)
        .input("deviceId", sql.VarChar, deviceId)
        .query("INSERT INTO AutomationScheduleTargets (AutomationScheduleId, DeviceId) VALUES (@scheduleId, @deviceId)");
    }
  }
}

export async function deleteSchedule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("UPDATE AutomationSchedules SET IsDeleted = 1, IsActive = 0 WHERE Id = @id");
}

export async function listDueSchedules(): Promise<AutomationSchedule[]> {
  const db = await getDb();
  const result = await db.query<{ Id: number }>(
    "SELECT Id FROM AutomationSchedules WHERE IsActive = 1 AND IsDeleted = 0 AND NextRunAt <= SYSUTCDATETIME()"
  );
  const schedules: AutomationSchedule[] = [];
  for (const row of result.recordset) {
    const schedule = await getSchedule(row.Id);
    if (schedule) schedules.push(schedule);
  }
  return schedules;
}

export async function advanceScheduleAfterRun(id: number, intervalMinutes: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, id)
    .input("intervalMinutes", sql.Int, intervalMinutes)
    .query(`
      UPDATE AutomationSchedules
      SET LastRunAt = SYSUTCDATETIME(), NextRunAt = DATEADD(MINUTE, @intervalMinutes, SYSUTCDATETIME())
      WHERE Id = @id
    `);
}

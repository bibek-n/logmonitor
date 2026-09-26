import { getDb, sql } from "@/lib/db";
import { getSummary } from "@/lib/securityUpdates/queries";
import { ENTRY_REASONS, INCIDENT_NUMBER_RE, INCIDENT_SEVERITIES, INCIDENT_STATUSES, STEP_TYPES, TASK_GROUPS, TASK_STATUSES, TASK_TYPES, type TaskGroup } from "./constants";

// Server Room Entry, tasks, security incidents and the operations audit trail.
// All timestamps are SYSUTCDATETIME() on the server (never taken from the browser) and go out as ISO-8601 UTC
// strings without a zone marker (CONVERT ... 126); clients render them with formatUtcTimestamp().

export class ServerRoomError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface Actor {
  userId: number;
  username: string;
}

type Tx = sql.Transaction;

const iso = (col: string) => `CONVERT(VARCHAR(19), ${col}, 126)`;

function clean(s: string | null | undefined, max: number): string | null {
  const v = (s ?? "").trim();
  return v ? v.slice(0, max) : null;
}

// ---- audit ------------------------------------------------------------------------------------------

export async function recordOpsAudit(
  tx: Tx | null,
  e: {
    eventType: string;
    staffName?: string | null;
    actor?: string | null;
    deviceId?: string | null;
    deviceLabel?: string | null;
    os?: string | null;
    taskType?: string | null;
    incidentNumber?: string | null;
    detail?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }
) {
  const db = await getDb();
  const rq = tx ? new sql.Request(tx) : db.request();
  await rq
    .input("eventType", sql.VarChar, e.eventType)
    .input("staff", sql.NVarChar, clean(e.staffName, 200))
    .input("actor", sql.NVarChar, clean(e.actor, 100))
    .input("deviceId", sql.VarChar, e.deviceId ?? null)
    .input("device", sql.NVarChar, clean(e.deviceLabel, 200))
    .input("os", sql.VarChar, e.os ?? null)
    .input("taskType", sql.NVarChar, clean(e.taskType, 80))
    .input("incident", sql.VarChar, e.incidentNumber ?? null)
    .input("detail", sql.NVarChar, clean(e.detail, 1000))
    .input("started", sql.DateTime2, e.startedAt ?? null)
    .input("completed", sql.DateTime2, e.completedAt ?? null)
    .query(`INSERT INTO OpsAuditLog (EventType, StaffName, ActorName, DeviceId, DeviceLabel, OS, TaskType, IncidentNumber, Detail, StartedAt, CompletedAt)
      VALUES (@eventType, @staff, @actor, @deviceId, @device, @os, @taskType, @incident, @detail, @started, @completed)`);
}

// ---- lookups ------------------------------------------------------------------------------------------

async function staffName(tx: Tx | null, staffId: number): Promise<string> {
  const db = await getDb();
  const rq = tx ? new sql.Request(tx) : db.request();
  const r = await rq.input("id", sql.Int, staffId).query<{ Name: string }>("SELECT Name FROM Staff WHERE Id = @id");
  if (!r.recordset[0]) throw new ServerRoomError("Staff member not found", 400);
  return r.recordset[0].Name;
}

async function deviceInfo(tx: Tx | null, deviceId: string): Promise<{ label: string; os: string | null }> {
  const db = await getDb();
  const rq = tx ? new sql.Request(tx) : db.request();
  const r = await rq.input("id", sql.VarChar, deviceId).query<{ Hostname: string; DeviceName: string | null; OS: string | null }>("SELECT Hostname, DeviceName, OS FROM Devices WHERE DeviceId = @id");
  if (!r.recordset[0]) throw new ServerRoomError("Server/device not found", 400);
  return { label: r.recordset[0].DeviceName || r.recordset[0].Hostname, os: r.recordset[0].OS };
}

async function requireIncident(tx: Tx | null, number: string): Promise<{ id: number; title: string; status: string }> {
  if (!INCIDENT_NUMBER_RE.test(number)) throw new ServerRoomError("Incident ID must look like INC-2026-000001", 400);
  const db = await getDb();
  const rq = tx ? new sql.Request(tx) : db.request();
  const r = await rq.input("n", sql.VarChar, number).query<{ Id: number; Title: string; Status: string }>("SELECT Id, Title, Status FROM SecurityIncidents WHERE IncidentNumber = @n");
  if (!r.recordset[0]) throw new ServerRoomError(`Incident ${number} does not exist`, 400);
  return { id: r.recordset[0].Id, title: r.recordset[0].Title, status: r.recordset[0].Status };
}

async function addStep(
  tx: Tx,
  incidentId: number,
  step: { type: string; summary: string; deviceId?: string | null; deviceLabel?: string | null; updateKey?: string | null; entryId?: number | null; taskId?: number | null; staffName?: string | null },
  actor: string
) {
  await new sql.Request(tx)
    .input("incidentId", sql.Int, incidentId)
    .input("type", sql.VarChar, step.type)
    .input("summary", sql.NVarChar, clean(step.summary, 1000) ?? "-")
    .input("deviceId", sql.VarChar, step.deviceId ?? null)
    .input("device", sql.NVarChar, clean(step.deviceLabel, 200))
    .input("updateKey", sql.NVarChar, clean(step.updateKey, 300))
    .input("entryId", sql.Int, step.entryId ?? null)
    .input("taskId", sql.Int, step.taskId ?? null)
    .input("staff", sql.NVarChar, clean(step.staffName, 200))
    .input("actor", sql.NVarChar, clean(actor, 100))
    .query(`INSERT INTO IncidentTimeline (IncidentId, StepType, Summary, DeviceId, DeviceLabel, UpdateKey, EntryId, TaskId, StaffName, ActorName)
      VALUES (@incidentId, @type, @summary, @deviceId, @device, @updateKey, @entryId, @taskId, @staff, @actor)`);
  await new sql.Request(tx).input("id", sql.Int, incidentId).query("UPDATE SecurityIncidents SET UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
}

async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = await getDb();
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

// ---- options for the forms ------------------------------------------------------------------------------

export async function getOptions() {
  const db = await getDb();
  const [staff, devices, active] = await Promise.all([
    db.query<{ Id: number; Name: string }>("SELECT Id, Name FROM Staff WHERE EmploymentStatus = 'Active' ORDER BY Name"),
    db.query<{ DeviceId: string; Hostname: string; DeviceName: string | null; OS: string | null; DeviceType: string }>(
      "SELECT DeviceId, Hostname, DeviceName, OS, DeviceType FROM Devices ORDER BY CASE WHEN DeviceType = 'Server' THEN 0 ELSE 1 END, Hostname"
    ),
    db.query<{ Id: number; StaffId: number | null; StaffName: string }>("SELECT Id, StaffId, StaffName FROM ServerRoomEntries WHERE ExitAt IS NULL ORDER BY EntryAt DESC"),
  ]);
  return {
    staff: staff.recordset.map((s) => ({ id: s.Id, name: s.Name })),
    devices: devices.recordset.map((d) => ({ deviceId: d.DeviceId, label: d.DeviceName || d.Hostname, os: d.OS, type: d.DeviceType })),
    activeEntries: active.recordset.map((a) => ({ id: a.Id, staffId: a.StaffId, staffName: a.StaffName })),
  };
}

// ---- entries --------------------------------------------------------------------------------------------

export interface EntryFilters {
  from?: string;
  to?: string;
  staff?: string;
  reason?: string;
  status?: string; // active | completed
  incident?: string;
  page: number;
  pageSize: number;
}

const DATE_OK = /^\d{4}-\d{2}-\d{2}$/;

function entryWhere(f: EntryFilters, rq: sql.Request): string {
  const w = ["1 = 1"];
  if (f.from && DATE_OK.test(f.from)) {
    rq.input("from", sql.DateTime2, new Date(`${f.from}T00:00:00Z`));
    w.push("e.EntryAt >= @from");
  }
  if (f.to && DATE_OK.test(f.to)) {
    rq.input("to", sql.DateTime2, new Date(`${f.to}T00:00:00Z`));
    w.push("e.EntryAt < DATEADD(DAY, 1, @to)");
  }
  if (f.staff) {
    rq.input("staff", sql.NVarChar, `%${f.staff}%`);
    w.push("e.StaffName LIKE @staff");
  }
  if (f.reason) {
    rq.input("reason", sql.VarChar, f.reason);
    w.push("e.ReasonCategory = @reason");
  }
  if (f.status === "active") w.push("e.ExitAt IS NULL");
  if (f.status === "completed") w.push("e.ExitAt IS NOT NULL");
  if (f.incident) {
    rq.input("incident", sql.VarChar, f.incident);
    w.push("e.IncidentNumber = @incident");
  }
  return w.join(" AND ");
}

export async function listEntries(f: EntryFilters) {
  const db = await getDb();
  const cq = db.request();
  const where = entryWhere(f, cq);
  const total = await cq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM ServerRoomEntries e WHERE ${where}`);
  const rq = db.request();
  entryWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(`
    SELECT e.Id, e.StaffId, e.StaffName, ${iso("e.EntryAt")} AS EntryAt, ${iso("e.ExitAt")} AS ExitAt, e.ReasonCategory, e.WorkPerformed, e.IncidentNumber,
      e.RecordedByName, e.ExitRecordedByName,
      DATEDIFF(MINUTE, e.EntryAt, COALESCE(e.ExitAt, SYSUTCDATETIME())) AS Minutes,
      (SELECT COUNT(*) FROM ServerRoomTasks t WHERE t.EntryId = e.Id) AS TaskCount
    FROM ServerRoomEntries e WHERE ${where}
    ORDER BY e.EntryAt DESC, e.Id DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return {
    total: total.recordset[0]?.Cnt ?? 0,
    rows: rows.recordset.map((r) => ({
      id: r.Id as number,
      staffId: (r.StaffId as number | null) ?? null,
      staffName: r.StaffName as string,
      entryAt: r.EntryAt as string,
      exitAt: (r.ExitAt as string | null) ?? null,
      active: r.ExitAt === null,
      reason: r.ReasonCategory as string,
      workPerformed: (r.WorkPerformed as string | null) ?? null,
      incidentNumber: (r.IncidentNumber as string | null) ?? null,
      recordedBy: (r.RecordedByName as string | null) ?? null,
      minutes: r.Minutes as number,
      taskCount: r.TaskCount as number,
    })),
  };
}

export async function createEntry(input: { staffId: number; reason: string; workPerformed?: string | null; incidentNumber?: string | null }, actor: Actor) {
  if (!(ENTRY_REASONS as readonly string[]).includes(input.reason)) throw new ServerRoomError("Choose one of the listed reasons", 400);
  return inTransaction(async (tx) => {
    const name = await staffName(tx, input.staffId);
    const active = await new sql.Request(tx).input("id", sql.Int, input.staffId).query("SELECT TOP 1 Id FROM ServerRoomEntries WHERE StaffId = @id AND ExitAt IS NULL");
    if (active.recordset.length > 0) throw new ServerRoomError(`${name} is already inside the server room - record their exit first`, 409);
    const incident = input.incidentNumber ? await requireIncident(tx, input.incidentNumber) : null;

    const r = await new sql.Request(tx)
      .input("staffId", sql.Int, input.staffId)
      .input("name", sql.NVarChar, name)
      .input("reason", sql.VarChar, input.reason)
      .input("work", sql.NVarChar, clean(input.workPerformed, 2000))
      .input("incident", sql.VarChar, input.incidentNumber ?? null)
      .input("userId", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query<{ Id: number }>(`INSERT INTO ServerRoomEntries (StaffId, StaffName, ReasonCategory, WorkPerformed, IncidentNumber, RecordedByUserId, RecordedByName)
        OUTPUT INSERTED.Id VALUES (@staffId, @name, @reason, @work, @incident, @userId, @by)`);
    const id = r.recordset[0].Id;
    await recordOpsAudit(tx, { eventType: "server_room_entry", staffName: name, actor: actor.username, taskType: input.reason, incidentNumber: input.incidentNumber ?? null, detail: `${name} entered the server room: ${input.reason}`, startedAt: new Date() });
    if (incident) await addStep(tx, incident.id, { type: "staff", summary: `${name} entered the server room (${input.reason})`, entryId: id, staffName: name }, actor.username);
    return id;
  });
}

export async function updateEntry(id: number, input: { action?: "exit"; workPerformed?: string | null; incidentNumber?: string | null }, actor: Actor) {
  return inTransaction(async (tx) => {
    const cur = await new sql.Request(tx).input("id", sql.Int, id).query<{ StaffName: string; ExitAt: Date | null; EntryAt: Date; ReasonCategory: string; IncidentNumber: string | null }>(
      "SELECT StaffName, ExitAt, EntryAt, ReasonCategory, IncidentNumber FROM ServerRoomEntries WITH (UPDLOCK) WHERE Id = @id"
    );
    const e = cur.recordset[0];
    if (!e) throw new ServerRoomError("Entry not found", 404);

    let incidentNumber = e.IncidentNumber;
    let newIncident: { id: number } | null = null;
    if (input.incidentNumber !== undefined && input.incidentNumber !== e.IncidentNumber) {
      if (input.incidentNumber) newIncident = await requireIncident(tx, input.incidentNumber);
      incidentNumber = input.incidentNumber || null;
    }

    if (input.action === "exit") {
      if (e.ExitAt) throw new ServerRoomError("This visit already has an exit time", 409);
      const work = input.workPerformed !== undefined ? clean(input.workPerformed, 2000) : undefined;
      const rq = new sql.Request(tx).input("id", sql.Int, id).input("by", sql.NVarChar, actor.username).input("incident", sql.VarChar, incidentNumber);
      if (work !== undefined) rq.input("work", sql.NVarChar, work);
      await rq.query(`UPDATE ServerRoomEntries SET ExitAt = SYSUTCDATETIME(), ExitRecordedByName = @by, IncidentNumber = @incident ${work !== undefined ? ", WorkPerformed = @work" : ""} WHERE Id = @id`);
      const minutes = Math.max(0, Math.round((Date.now() - e.EntryAt.getTime()) / 60000));
      await recordOpsAudit(tx, { eventType: "server_room_exit", staffName: e.StaffName, actor: actor.username, taskType: e.ReasonCategory, incidentNumber, detail: `${e.StaffName} left the server room after ${minutes} min${work ? `: ${work}` : ""}`, startedAt: e.EntryAt, completedAt: new Date() });
    } else {
      const rq = new sql.Request(tx).input("id", sql.Int, id).input("incident", sql.VarChar, incidentNumber);
      const sets = ["IncidentNumber = @incident"];
      if (input.workPerformed !== undefined) {
        rq.input("work", sql.NVarChar, clean(input.workPerformed, 2000));
        sets.push("WorkPerformed = @work");
      }
      await rq.query(`UPDATE ServerRoomEntries SET ${sets.join(", ")} WHERE Id = @id`);
      await recordOpsAudit(tx, { eventType: "server_room_entry_updated", staffName: e.StaffName, actor: actor.username, taskType: e.ReasonCategory, incidentNumber, detail: "Entry details updated" });
    }
    if (newIncident) await addStep(tx, newIncident.id, { type: "staff", summary: `${e.StaffName} - server room visit (${e.ReasonCategory})`, entryId: id, staffName: e.StaffName }, actor.username);
  });
}

// ---- tasks ---------------------------------------------------------------------------------------------

export interface TaskFilters {
  from?: string;
  to?: string;
  staff?: string;
  group?: string;
  type?: string;
  status?: string;
  device?: string;
  incident?: string;
  page: number;
  pageSize: number;
}

function taskWhere(f: TaskFilters, rq: sql.Request): string {
  const w = ["1 = 1"];
  if (f.from && DATE_OK.test(f.from)) {
    rq.input("from", sql.DateTime2, new Date(`${f.from}T00:00:00Z`));
    w.push("t.StartAt >= @from");
  }
  if (f.to && DATE_OK.test(f.to)) {
    rq.input("to", sql.DateTime2, new Date(`${f.to}T00:00:00Z`));
    w.push("t.StartAt < DATEADD(DAY, 1, @to)");
  }
  if (f.staff) {
    rq.input("staff", sql.NVarChar, `%${f.staff}%`);
    w.push("t.StaffName LIKE @staff");
  }
  if (f.group) {
    rq.input("group", sql.VarChar, f.group);
    w.push("t.TaskGroup = @group");
  }
  if (f.type) {
    rq.input("type", sql.NVarChar, f.type);
    w.push("t.TaskType = @type");
  }
  if (f.status) {
    rq.input("status", sql.VarChar, f.status);
    w.push("t.Status = @status");
  }
  if (f.device) {
    rq.input("device", sql.NVarChar, `%${f.device}%`);
    w.push("t.DeviceLabel LIKE @device");
  }
  if (f.incident) {
    rq.input("incident", sql.VarChar, f.incident);
    w.push("t.IncidentNumber = @incident");
  }
  return w.join(" AND ");
}

export async function listTasks(f: TaskFilters) {
  const db = await getDb();
  const cq = db.request();
  const where = taskWhere(f, cq);
  const total = await cq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM ServerRoomTasks t WHERE ${where}`);
  const rq = db.request();
  taskWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(`
    SELECT t.Id, t.EntryId, t.StaffName, t.TaskGroup, t.TaskType, t.DeviceId, t.DeviceLabel, t.Description, ${iso("t.StartAt")} AS StartAt, ${iso("t.EndAt")} AS EndAt,
      t.Status, t.IncidentNumber, t.RecordedByName, d.OS
    FROM ServerRoomTasks t LEFT JOIN Devices d ON d.DeviceId = t.DeviceId WHERE ${where}
    ORDER BY t.StartAt DESC, t.Id DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return {
    total: total.recordset[0]?.Cnt ?? 0,
    rows: rows.recordset.map((r) => ({
      id: r.Id as number,
      entryId: (r.EntryId as number | null) ?? null,
      staffName: r.StaffName as string,
      group: r.TaskGroup as string,
      type: r.TaskType as string,
      deviceId: (r.DeviceId as string | null) ?? null,
      device: (r.DeviceLabel as string | null) ?? null,
      os: (r.OS as string | null) ?? null,
      description: r.Description as string,
      startAt: r.StartAt as string,
      endAt: (r.EndAt as string | null) ?? null,
      status: r.Status as string,
      incidentNumber: (r.IncidentNumber as string | null) ?? null,
      recordedBy: (r.RecordedByName as string | null) ?? null,
    })),
  };
}

export async function createTask(
  input: { staffId: number; group: string; type: string; deviceId?: string | null; deviceLabel?: string | null; description: string; entryId?: number | null; incidentNumber?: string | null; status?: string },
  actor: Actor
) {
  if (!(TASK_GROUPS as readonly string[]).includes(input.group)) throw new ServerRoomError("Choose a task group", 400);
  if (!TASK_TYPES[input.group as TaskGroup].includes(input.type)) throw new ServerRoomError("That task type does not belong to the chosen group", 400);
  const status = input.status ?? "In Progress";
  if (!(TASK_STATUSES as readonly string[]).includes(status)) throw new ServerRoomError("Invalid status", 400);
  if (!clean(input.description, 2000)) throw new ServerRoomError("Describe the work", 400);

  return inTransaction(async (tx) => {
    const name = await staffName(tx, input.staffId);
    let deviceId: string | null = null;
    let deviceLabel = clean(input.deviceLabel, 200);
    let os: string | null = null;
    if (input.deviceId) {
      const d = await deviceInfo(tx, input.deviceId);
      deviceId = input.deviceId;
      deviceLabel = d.label;
      os = d.os;
    }
    if (input.entryId) {
      const e = await new sql.Request(tx).input("id", sql.Int, input.entryId).query("SELECT 1 FROM ServerRoomEntries WHERE Id = @id");
      if (e.recordset.length === 0) throw new ServerRoomError("Server room entry not found", 400);
    }
    const incident = input.incidentNumber ? await requireIncident(tx, input.incidentNumber) : null;
    const closed = status === "Completed" || status === "Cancelled";

    const r = await new sql.Request(tx)
      .input("entryId", sql.Int, input.entryId ?? null)
      .input("staffId", sql.Int, input.staffId)
      .input("name", sql.NVarChar, name)
      .input("group", sql.VarChar, input.group)
      .input("type", sql.NVarChar, input.type)
      .input("deviceId", sql.VarChar, deviceId)
      .input("device", sql.NVarChar, deviceLabel)
      .input("desc", sql.NVarChar, clean(input.description, 2000))
      .input("status", sql.VarChar, status)
      .input("incident", sql.VarChar, input.incidentNumber ?? null)
      .input("userId", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query<{ Id: number }>(`INSERT INTO ServerRoomTasks (EntryId, StaffId, StaffName, TaskGroup, TaskType, DeviceId, DeviceLabel, Description, Status, IncidentNumber, EndAt, RecordedByUserId, RecordedByName)
        OUTPUT INSERTED.Id VALUES (@entryId, @staffId, @name, @group, @type, @deviceId, @device, @desc, @status, @incident, ${closed ? "SYSUTCDATETIME()" : "NULL"}, @userId, @by)`);
    const id = r.recordset[0].Id;
    await recordOpsAudit(tx, {
      eventType: closed ? "task_completed" : "task_started",
      staffName: name,
      actor: actor.username,
      deviceId,
      deviceLabel,
      os,
      taskType: `${input.group}: ${input.type}`,
      incidentNumber: input.incidentNumber ?? null,
      detail: clean(input.description, 500),
      startedAt: new Date(),
      completedAt: closed ? new Date() : null,
    });
    if (incident) await addStep(tx, incident.id, { type: "task", summary: `${input.group}: ${input.type} - ${clean(input.description, 300)}`, deviceId, deviceLabel, taskId: id, staffName: name }, actor.username);
    return id;
  });
}

export async function updateTask(id: number, input: { status?: string; description?: string; incidentNumber?: string | null }, actor: Actor) {
  if (input.status && !(TASK_STATUSES as readonly string[]).includes(input.status)) throw new ServerRoomError("Invalid status", 400);
  return inTransaction(async (tx) => {
    const cur = await new sql.Request(tx).input("id", sql.Int, id).query<{ StaffName: string; TaskGroup: string; TaskType: string; DeviceId: string | null; DeviceLabel: string | null; Status: string; StartAt: Date; IncidentNumber: string | null; Description: string }>(
      "SELECT StaffName, TaskGroup, TaskType, DeviceId, DeviceLabel, Status, StartAt, IncidentNumber, Description FROM ServerRoomTasks WITH (UPDLOCK) WHERE Id = @id"
    );
    const t = cur.recordset[0];
    if (!t) throw new ServerRoomError("Task not found", 404);

    let incidentNumber = t.IncidentNumber;
    let linked: { id: number } | null = null;
    if (input.incidentNumber !== undefined && input.incidentNumber !== t.IncidentNumber) {
      if (input.incidentNumber) linked = await requireIncident(tx, input.incidentNumber);
      incidentNumber = input.incidentNumber || null;
    }
    const status = input.status ?? t.Status;
    const nowClosed = (status === "Completed" || status === "Cancelled") && !(t.Status === "Completed" || t.Status === "Cancelled");
    const reopened = (status === "In Progress" || status === "Blocked") && (t.Status === "Completed" || t.Status === "Cancelled");

    const rq = new sql.Request(tx).input("id", sql.Int, id).input("status", sql.VarChar, status).input("incident", sql.VarChar, incidentNumber);
    const sets = ["Status = @status", "IncidentNumber = @incident"];
    if (input.description !== undefined) {
      if (!clean(input.description, 2000)) throw new ServerRoomError("Describe the work", 400);
      rq.input("desc", sql.NVarChar, clean(input.description, 2000));
      sets.push("Description = @desc");
    }
    if (nowClosed) sets.push("EndAt = SYSUTCDATETIME()");
    if (reopened) sets.push("EndAt = NULL");
    await rq.query(`UPDATE ServerRoomTasks SET ${sets.join(", ")} WHERE Id = @id`);

    if (nowClosed || status !== t.Status) {
      await recordOpsAudit(tx, {
        eventType: nowClosed ? "task_completed" : "task_status_changed",
        staffName: t.StaffName,
        actor: actor.username,
        deviceId: t.DeviceId,
        deviceLabel: t.DeviceLabel,
        taskType: `${t.TaskGroup}: ${t.TaskType}`,
        incidentNumber,
        detail: `${t.Status} -> ${status}`,
        startedAt: t.StartAt,
        completedAt: nowClosed ? new Date() : null,
      });
    }
    if (linked) await addStep(tx, linked.id, { type: "task", summary: `${t.TaskGroup}: ${t.TaskType} - ${clean(t.Description, 300)}`, deviceId: t.DeviceId, deviceLabel: t.DeviceLabel, taskId: id, staffName: t.StaffName }, actor.username);
  });
}

// ---- incidents -----------------------------------------------------------------------------------------

async function nextIncidentNumber(tx: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const upd = await new sql.Request(tx)
    .input("y", sql.Int, year)
    .query<{ LastNumber: number }>("UPDATE IncidentCounters WITH (UPDLOCK, HOLDLOCK) SET LastNumber = LastNumber + 1 OUTPUT INSERTED.LastNumber WHERE CounterYear = @y");
  let n = upd.recordset[0]?.LastNumber;
  if (n === undefined) {
    await new sql.Request(tx).input("y", sql.Int, year).query("INSERT INTO IncidentCounters (CounterYear, LastNumber) VALUES (@y, 1)");
    n = 1;
  }
  return `INC-${year}-${String(n).padStart(6, "0")}`;
}

export interface IncidentFilters {
  status?: string;
  severity?: string;
  q?: string;
  page: number;
  pageSize: number;
}

function incidentWhere(f: IncidentFilters, rq: sql.Request): string {
  const w = ["1 = 1"];
  if (f.status === "open") w.push("i.Status IN ('Open', 'Investigating')");
  else if (f.status) {
    rq.input("status", sql.VarChar, f.status);
    w.push("i.Status = @status");
  }
  if (f.severity) {
    rq.input("sev", sql.VarChar, f.severity);
    w.push("i.Severity = @sev");
  }
  if (f.q) {
    rq.input("q", sql.NVarChar, `%${f.q}%`);
    w.push("(i.IncidentNumber LIKE @q OR i.Title LIKE @q OR i.DeviceLabel LIKE @q)");
  }
  return w.join(" AND ");
}

export async function listIncidents(f: IncidentFilters) {
  const db = await getDb();
  const cq = db.request();
  const where = incidentWhere(f, cq);
  const total = await cq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM SecurityIncidents i WHERE ${where}`);
  const rq = db.request();
  incidentWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(`
    SELECT i.IncidentNumber, i.Title, i.Severity, i.Status, i.DeviceId, i.DeviceLabel, i.CreatedByName, ${iso("i.CreatedAt")} AS CreatedAt, ${iso("i.UpdatedAt")} AS UpdatedAt, ${iso("i.ResolvedAt")} AS ResolvedAt,
      (SELECT COUNT(*) FROM IncidentTimeline t WHERE t.IncidentId = i.Id) AS Steps
    FROM SecurityIncidents i WHERE ${where}
    ORDER BY CASE WHEN i.Status IN ('Open', 'Investigating') THEN 0 ELSE 1 END, i.CreatedAt DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return {
    total: total.recordset[0]?.Cnt ?? 0,
    rows: rows.recordset.map((r) => ({
      number: r.IncidentNumber as string,
      title: r.Title as string,
      severity: r.Severity as string,
      status: r.Status as string,
      deviceId: (r.DeviceId as string | null) ?? null,
      device: (r.DeviceLabel as string | null) ?? null,
      createdBy: (r.CreatedByName as string | null) ?? null,
      createdAt: r.CreatedAt as string,
      updatedAt: r.UpdatedAt as string,
      resolvedAt: (r.ResolvedAt as string | null) ?? null,
      steps: r.Steps as number,
    })),
  };
}

export async function getIncident(number: string) {
  if (!INCIDENT_NUMBER_RE.test(number)) return null;
  const db = await getDb();
  const inc = await db.request().input("n", sql.VarChar, number).query(`
    SELECT Id, IncidentNumber, Title, Severity, Status, DeviceId, DeviceLabel, Description, Resolution, CreatedByName, ${iso("CreatedAt")} AS CreatedAt, ${iso("UpdatedAt")} AS UpdatedAt, ${iso("ResolvedAt")} AS ResolvedAt
    FROM SecurityIncidents WHERE IncidentNumber = @n`);
  const i = inc.recordset[0];
  if (!i) return null;
  const [steps, updates, tasks, entries] = await Promise.all([
    db.request().input("id", sql.Int, i.Id).query(`SELECT Id, StepType, Summary, DeviceLabel, UpdateKey, StaffName, ActorName, ${iso("CreatedAt")} AS CreatedAt FROM IncidentTimeline WHERE IncidentId = @id ORDER BY CreatedAt, Id`),
    db.request().input("n", sql.VarChar, number).query(`SELECT UpdateKey, Title, Category, Severity, Status, DeviceId FROM DeviceUpdates WHERE IncidentNumber = @n ORDER BY Title`),
    db.request().input("n", sql.VarChar, number).query(`SELECT Id, StaffName, TaskGroup, TaskType, DeviceLabel, Status, ${iso("StartAt")} AS StartAt FROM ServerRoomTasks WHERE IncidentNumber = @n ORDER BY StartAt`),
    db.request().input("n", sql.VarChar, number).query(`SELECT Id, StaffName, ReasonCategory, ${iso("EntryAt")} AS EntryAt, ${iso("ExitAt")} AS ExitAt FROM ServerRoomEntries WHERE IncidentNumber = @n ORDER BY EntryAt`),
  ]);
  return {
    number: i.IncidentNumber as string,
    title: i.Title as string,
    severity: i.Severity as string,
    status: i.Status as string,
    deviceId: (i.DeviceId as string | null) ?? null,
    device: (i.DeviceLabel as string | null) ?? null,
    description: (i.Description as string | null) ?? null,
    resolution: (i.Resolution as string | null) ?? null,
    createdBy: (i.CreatedByName as string | null) ?? null,
    createdAt: i.CreatedAt as string,
    updatedAt: i.UpdatedAt as string,
    resolvedAt: (i.ResolvedAt as string | null) ?? null,
    timeline: steps.recordset.map((s) => ({ id: s.Id as number, type: s.StepType as string, summary: s.Summary as string, device: (s.DeviceLabel as string | null) ?? null, updateKey: (s.UpdateKey as string | null) ?? null, staff: (s.StaffName as string | null) ?? null, actor: (s.ActorName as string | null) ?? null, at: s.CreatedAt as string })),
    updates: updates.recordset.map((u) => ({ key: u.UpdateKey as string, title: u.Title as string, category: u.Category as string, severity: u.Severity as string, status: u.Status as string })),
    tasks: tasks.recordset.map((t) => ({ id: t.Id as number, staff: t.StaffName as string, group: t.TaskGroup as string, type: t.TaskType as string, device: (t.DeviceLabel as string | null) ?? null, status: t.Status as string, startAt: t.StartAt as string })),
    entries: entries.recordset.map((e) => ({ id: e.Id as number, staff: e.StaffName as string, reason: e.ReasonCategory as string, entryAt: e.EntryAt as string, exitAt: (e.ExitAt as string | null) ?? null })),
  };
}

export async function createIncident(
  input: { title: string; severity?: string; description?: string | null; deviceId?: string | null; updateKeys?: string[]; staffName?: string | null },
  actor: Actor
): Promise<string> {
  const title = clean(input.title, 300);
  if (!title) throw new ServerRoomError("Give the incident a title", 400);
  const severity = input.severity ?? "medium";
  if (!(INCIDENT_SEVERITIES as readonly string[]).includes(severity)) throw new ServerRoomError("Invalid severity", 400);

  return inTransaction(async (tx) => {
    let deviceLabel: string | null = null;
    let os: string | null = null;
    if (input.deviceId) {
      const d = await deviceInfo(tx, input.deviceId);
      deviceLabel = d.label;
      os = d.os;
    }
    const number = await nextIncidentNumber(tx);
    const r = await new sql.Request(tx)
      .input("number", sql.VarChar, number)
      .input("title", sql.NVarChar, title)
      .input("severity", sql.VarChar, severity)
      .input("deviceId", sql.VarChar, input.deviceId ?? null)
      .input("device", sql.NVarChar, deviceLabel)
      .input("desc", sql.NVarChar, clean(input.description, 2000))
      .input("userId", sql.Int, actor.userId)
      .input("by", sql.NVarChar, actor.username)
      .query<{ Id: number }>(`INSERT INTO SecurityIncidents (IncidentNumber, Title, Severity, DeviceId, DeviceLabel, Description, CreatedByUserId, CreatedByName)
        OUTPUT INSERTED.Id VALUES (@number, @title, @severity, @deviceId, @device, @desc, @userId, @by)`);
    const incidentId = r.recordset[0].Id;

    await addStep(tx, incidentId, { type: "finding", summary: `Incident opened: ${title}${input.description ? ` - ${clean(input.description, 400)}` : ""}`, deviceId: input.deviceId ?? null, deviceLabel, staffName: input.staffName ?? null }, actor.username);

    // Link the failed/critical updates the incident was raised from: device -> finding -> update.
    for (const key of input.updateKeys ?? []) {
      if (!input.deviceId) break;
      const u = await new sql.Request(tx)
        .input("d", sql.VarChar, input.deviceId)
        .input("k", sql.NVarChar, key)
        .query<{ Title: string; Category: string; Status: string }>("SELECT Title, Category, Status FROM DeviceUpdates WHERE DeviceId = @d AND UpdateKey = @k");
      if (!u.recordset[0]) continue;
      await new sql.Request(tx).input("d", sql.VarChar, input.deviceId).input("k", sql.NVarChar, key).input("n", sql.VarChar, number).query("UPDATE DeviceUpdates SET IncidentNumber = @n WHERE DeviceId = @d AND UpdateKey = @k");
      await addStep(tx, incidentId, { type: "update", summary: `${u.recordset[0].Title} (${u.recordset[0].Category}, ${u.recordset[0].Status})`, deviceId: input.deviceId, deviceLabel, updateKey: key }, actor.username);
      await new sql.Request(tx)
        .input("d", sql.VarChar, input.deviceId)
        .input("h", sql.NVarChar, deviceLabel)
        .input("os", sql.VarChar, os)
        .input("k", sql.NVarChar, key)
        .input("t", sql.NVarChar, u.recordset[0].Title)
        .input("c", sql.VarChar, u.recordset[0].Category)
        .input("n", sql.VarChar, number)
        .input("actor", sql.NVarChar, actor.username)
        .input("uid", sql.Int, actor.userId)
        .query(`INSERT INTO UpdateHistory (DeviceId, Hostname, OS, EventType, UpdateKey, Title, Category, Detail, ActorUserId, ActorName, IncidentNumber)
          VALUES (@d, @h, @os, 'incident_linked', @k, @t, @c, 'Linked to incident', @uid, @actor, @n)`);
    }

    await recordOpsAudit(tx, { eventType: "incident_created", staffName: input.staffName ?? null, actor: actor.username, deviceId: input.deviceId ?? null, deviceLabel, os, incidentNumber: number, detail: `${title} (${severity})` });
    return number;
  });
}

export async function updateIncident(number: string, input: { status?: string; severity?: string; resolution?: string | null }, actor: Actor) {
  if (input.status && !(INCIDENT_STATUSES as readonly string[]).includes(input.status)) throw new ServerRoomError("Invalid status", 400);
  if (input.severity && !(INCIDENT_SEVERITIES as readonly string[]).includes(input.severity)) throw new ServerRoomError("Invalid severity", 400);
  return inTransaction(async (tx) => {
    const cur = await new sql.Request(tx).input("n", sql.VarChar, number).query<{ Id: number; Status: string; Severity: string; Title: string; DeviceId: string | null; DeviceLabel: string | null; Resolution: string | null }>(
      "SELECT Id, Status, Severity, Title, DeviceId, DeviceLabel, Resolution FROM SecurityIncidents WITH (UPDLOCK) WHERE IncidentNumber = @n"
    );
    const i = cur.recordset[0];
    if (!i) throw new ServerRoomError("Incident not found", 404);

    const status = input.status ?? i.Status;
    const severity = input.severity ?? i.Severity;
    const resolution = input.resolution !== undefined ? clean(input.resolution, 2000) : i.Resolution;
    const closing = status === "Resolved" || status === "Closed";
    if (closing && !resolution) throw new ServerRoomError("Write the resolution before resolving or closing an incident", 400);
    const wasClosed = i.Status === "Resolved" || i.Status === "Closed";

    await new sql.Request(tx)
      .input("id", sql.Int, i.Id)
      .input("status", sql.VarChar, status)
      .input("severity", sql.VarChar, severity)
      .input("resolution", sql.NVarChar, resolution)
      .query(`UPDATE SecurityIncidents SET Status = @status, Severity = @severity, Resolution = @resolution, UpdatedAt = SYSUTCDATETIME(),
        ResolvedAt = ${closing ? "COALESCE(ResolvedAt, SYSUTCDATETIME())" : "NULL"} WHERE Id = @id`);

    if (status !== i.Status) {
      await addStep(tx, i.Id, { type: closing && !wasClosed ? "resolution" : "action", summary: closing && !wasClosed ? `Resolved: ${resolution}` : `Status ${i.Status} -> ${status}`, deviceId: i.DeviceId, deviceLabel: i.DeviceLabel }, actor.username);
      await recordOpsAudit(tx, { eventType: "incident_status_changed", actor: actor.username, deviceId: i.DeviceId, deviceLabel: i.DeviceLabel, incidentNumber: number, detail: `${i.Status} -> ${status}${closing ? `: ${resolution}` : ""}` });
    }
    if (severity !== i.Severity) {
      await addStep(tx, i.Id, { type: "action", summary: `Severity ${i.Severity} -> ${severity}` }, actor.username);
    }
  });
}

export async function addIncidentStep(number: string, input: { type: string; summary: string; staffName?: string | null; deviceId?: string | null }, actor: Actor) {
  if (!(STEP_TYPES as readonly string[]).includes(input.type)) throw new ServerRoomError("Invalid step type", 400);
  if (!clean(input.summary, 1000)) throw new ServerRoomError("Write what happened", 400);
  return inTransaction(async (tx) => {
    const inc = await requireIncident(tx, number);
    let deviceLabel: string | null = null;
    if (input.deviceId) deviceLabel = (await deviceInfo(tx, input.deviceId)).label;
    await addStep(tx, inc.id, { type: input.type, summary: input.summary, deviceId: input.deviceId ?? null, deviceLabel, staffName: input.staffName ?? null }, actor.username);
    await recordOpsAudit(tx, { eventType: "incident_activity", staffName: input.staffName ?? null, actor: actor.username, deviceId: input.deviceId ?? null, deviceLabel, incidentNumber: number, taskType: input.type, detail: clean(input.summary, 500) });
  });
}

// ---- unified audit history --------------------------------------------------------------------------------

export interface AuditFilters {
  from?: string;
  to?: string;
  staff?: string;
  device?: string;
  taskType?: string;
  os?: string;
  incident?: string;
  q?: string;
  page: number;
  pageSize: number;
}

// Server-room / task / incident events (OpsAuditLog) and update scans / installs / failures (UpdateHistory) as ONE stream.
const AUDIT_UNION = `
  SELECT 'operations' AS Source, o.Id, o.EventType, o.CreatedAt, o.StaffName, o.ActorName, o.DeviceId, o.DeviceLabel AS Device, o.OS, o.TaskType, o.IncidentNumber, o.Detail, o.StartedAt, o.CompletedAt
  FROM OpsAuditLog o
  UNION ALL
  SELECT 'updates', h.Id, h.EventType, h.CreatedAt, NULL, h.ActorName, h.DeviceId, h.Hostname, h.OS, h.Category, h.IncidentNumber,
    LEFT(COALESCE(h.Title + ' - ', '') + COALESCE(h.Detail, ''), 1000), NULL, NULL
  FROM UpdateHistory h`;

function auditWhere(f: AuditFilters, rq: sql.Request): string {
  const w = ["1 = 1"];
  if (f.from && DATE_OK.test(f.from)) {
    rq.input("from", sql.DateTime2, new Date(`${f.from}T00:00:00Z`));
    w.push("a.CreatedAt >= @from");
  }
  if (f.to && DATE_OK.test(f.to)) {
    rq.input("to", sql.DateTime2, new Date(`${f.to}T00:00:00Z`));
    w.push("a.CreatedAt < DATEADD(DAY, 1, @to)");
  }
  if (f.staff) {
    rq.input("staff", sql.NVarChar, `%${f.staff}%`);
    w.push("(a.StaffName LIKE @staff OR a.ActorName LIKE @staff)");
  }
  if (f.device) {
    rq.input("device", sql.NVarChar, `%${f.device}%`);
    w.push("a.Device LIKE @device");
  }
  if (f.taskType) {
    rq.input("taskType", sql.NVarChar, `%${f.taskType}%`);
    w.push("a.TaskType LIKE @taskType");
  }
  if (f.os) {
    rq.input("os", sql.VarChar, f.os);
    w.push("a.OS = @os");
  }
  if (f.incident) {
    rq.input("incident", sql.VarChar, f.incident);
    w.push("a.IncidentNumber = @incident");
  }
  if (f.q) {
    rq.input("q", sql.NVarChar, `%${f.q}%`);
    w.push("(a.Detail LIKE @q OR a.EventType LIKE @q OR a.Device LIKE @q)");
  }
  return w.join(" AND ");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAudit(r: any) {
  return {
    source: r.Source as string,
    id: r.Id as number,
    eventType: r.EventType as string,
    at: r.At as string,
    staff: (r.StaffName as string | null) ?? null,
    actor: (r.ActorName as string | null) ?? null,
    deviceId: (r.DeviceId as string | null) ?? null,
    device: (r.Device as string | null) ?? null,
    os: (r.OS as string | null) ?? null,
    taskType: (r.TaskType as string | null) ?? null,
    incidentNumber: (r.IncidentNumber as string | null) ?? null,
    detail: (r.Detail as string | null) ?? null,
    startedAt: (r.Started as string | null) ?? null,
    completedAt: (r.Completed as string | null) ?? null,
  };
}

const AUDIT_COLUMNS = `a.Source, a.Id, a.EventType, ${iso("a.CreatedAt")} AS At, a.StaffName, a.ActorName, a.DeviceId, a.Device, a.OS, a.TaskType, a.IncidentNumber, a.Detail,
  ${iso("a.StartedAt")} AS Started, ${iso("a.CompletedAt")} AS Completed`;

export async function listAudit(f: AuditFilters) {
  const db = await getDb();
  const cq = db.request();
  const where = auditWhere(f, cq);
  const total = await cq.query<{ Cnt: number }>(`SELECT COUNT(*) AS Cnt FROM (${AUDIT_UNION}) a WHERE ${where}`);
  const rq = db.request();
  auditWhere(f, rq);
  rq.input("offset", sql.Int, (f.page - 1) * f.pageSize).input("pageSize", sql.Int, f.pageSize);
  const rows = await rq.query(`SELECT ${AUDIT_COLUMNS} FROM (${AUDIT_UNION}) a WHERE ${where} ORDER BY a.CreatedAt DESC, a.Id DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY`);
  return { total: total.recordset[0]?.Cnt ?? 0, rows: rows.recordset.map(mapAudit) };
}

export async function exportAudit(f: AuditFilters, limit = 5000) {
  const db = await getDb();
  const rq = db.request();
  const where = auditWhere(f, rq);
  const rows = await rq.query(`SELECT TOP (${Math.min(limit, 5000)}) ${AUDIT_COLUMNS} FROM (${AUDIT_UNION}) a WHERE ${where} ORDER BY a.CreatedAt DESC, a.Id DESC`);
  return rows.recordset.map(mapAudit);
}

// ---- dashboard (the 13 tiles) ----------------------------------------------------------------------------

// The server runs on Nepal time for the people reading these tiles; "today" means the local calendar day (UTC+5:45,
// fixed year-round - same constant and reasoning as src/lib/alerts.ts).
const LOCAL_OFFSET_MINUTES = 345;

export async function getDashboard() {
  const db = await getDb();
  const dayStart = `DATEADD(MINUTE, -${LOCAL_OFFSET_MINUTES}, CAST(CAST(DATEADD(MINUTE, ${LOCAL_OFFSET_MINUTES}, SYSUTCDATETIME()) AS DATE) AS DATETIME2))`;
  const [ops, updates] = await Promise.all([
    db.query<Record<string, number>>(`
      SELECT
        (SELECT COUNT(*) FROM ServerRoomEntries WHERE EntryAt >= ${dayStart}) AS EntriesToday,
        (SELECT COUNT(*) FROM ServerRoomEntries WHERE ExitAt IS NULL) AS ActiveEntries,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE Status = 'Completed' AND EndAt >= ${dayStart}) AS CompletedToday,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE Status = 'Completed') AS CompletedTotal,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Technical Support' AND StartAt >= ${dayStart}) AS TechnicalToday,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Technical Support' AND Status = 'In Progress') AS TechnicalOpen,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Website Hosting' AND StartAt >= ${dayStart}) AS HostingToday,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Website Hosting' AND Status = 'In Progress') AS HostingOpen,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Security Update' AND StartAt >= ${dayStart}) AS SecurityToday,
        (SELECT COUNT(*) FROM ServerRoomTasks WHERE TaskGroup = 'Security Update' AND Status = 'In Progress') AS SecurityOpen,
        (SELECT COUNT(*) FROM SecurityIncidents WHERE Status IN ('Open', 'Investigating')) AS OpenIncidents`),
    getSummary(),
  ]);
  const o = ops.recordset[0];
  return {
    entriesToday: o.EntriesToday,
    activeEntries: o.ActiveEntries,
    completedTasksToday: o.CompletedToday,
    completedTasksTotal: o.CompletedTotal,
    technicalToday: o.TechnicalToday,
    technicalOpen: o.TechnicalOpen,
    hostingToday: o.HostingToday,
    hostingOpen: o.HostingOpen,
    securityTasksToday: o.SecurityToday,
    securityTasksOpen: o.SecurityOpen,
    openIncidents: o.OpenIncidents,
    pendingSecurityUpdates: updates.totals.security,
    criticalUpdates: updates.totals.critical,
    failedUpdates: updates.totals.failed,
    windowsUpdates: updates.byOs.windows.updates,
    macosUpdates: updates.byOs.darwin.updates,
    linuxUpdates: updates.byOs.linux.updates,
    devicesScanned: updates.totals.scanned,
    devicesTotal: updates.totals.devices,
  };
}

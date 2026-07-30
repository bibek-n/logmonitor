import { getDb, sql } from "../db";
import { ApiAssertion, ApiHeader, ApiMonitorConfig, MonitorStatus, WebsiteMonitorConfig } from "./types";
import { decryptApiAuthConfig, encryptApiAuthConfig } from "./apiCredentials";
import type { z } from "zod";
import type { createApiMonitorSchema, createWebsiteMonitorSchema } from "./schema";

export interface WebsiteMonitorRow {
  id: number;
  name: string;
  description: string | null;
  environment: string | null;
  tags: string[];
  intervalSeconds: number;
  timeoutMs: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
  alertPolicyId: number | null;
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  isActive: boolean;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  createdAt: Date;
  config: WebsiteMonitorConfig;
}

interface JoinedRow {
  Id: number;
  Name: string;
  Description: string | null;
  Environment: string | null;
  Tags: string | null;
  IntervalSeconds: number;
  TimeoutMs: number;
  FailureConfirmCount: number;
  RecoveryConfirmCount: number;
  AlertPolicyId: number | null;
  Status: MonitorStatus;
  ConsecutiveFailures: number;
  ConsecutiveSuccesses: number;
  IsActive: boolean;
  LastCheckedAt: Date | null;
  NextCheckAt: Date;
  CreatedAt: Date;
  Url: string;
  HttpMethod: "GET" | "HEAD";
  ExpectedStatusCode: number;
  FollowRedirects: boolean;
  MaxRedirects: number;
  SslVerify: boolean;
  ExpectedKeyword: string | null;
  ForbiddenKeyword: string | null;
  ResponseTimeWarningMs: number;
  ResponseTimeCriticalMs: number;
  AlertEmail: string | null;
}

// LastCheckedAt/NextCheckAt/CreatedAt are selected as raw DATETIME2 (never CONVERT(...,126) to
// a string) - that string form has no 'Z'/offset, so a browser doing new Date(str) on it
// re-interprets an actual UTC instant as its OWN local time, silently showing the wrong moment
// (same bug class already fixed once in maintenanceWindows.ts). mssql returns a native,
// timezone-agnostic JS Date for a raw DATETIME2 column, and JSON.stringify(Date) always emits a
// real ...Z-suffixed ISO string, so the value survives the API round-trip correctly no matter
// what timezone the viewer's browser is in.
const JOIN_SELECT = `
  SELECT m.Id, m.Name, m.Description, m.Environment, m.Tags, m.IntervalSeconds, m.TimeoutMs,
    m.FailureConfirmCount, m.RecoveryConfirmCount, m.AlertPolicyId, m.Status,
    m.ConsecutiveFailures, m.ConsecutiveSuccesses, m.IsActive,
    m.LastCheckedAt, m.NextCheckAt, m.CreatedAt,
    w.Url, w.HttpMethod, w.ExpectedStatusCode, w.FollowRedirects, w.MaxRedirects, w.SslVerify,
    w.ExpectedKeyword, w.ForbiddenKeyword, w.ResponseTimeWarningMs, w.ResponseTimeCriticalMs, w.AlertEmail
  FROM Monitors m
  JOIN WebsiteMonitorConfigs w ON w.MonitorId = m.Id
  WHERE m.MonitorType = 'Website' AND m.IsDeleted = 0
`;

function toRow(r: JoinedRow): WebsiteMonitorRow {
  return {
    id: r.Id,
    name: r.Name,
    description: r.Description,
    environment: r.Environment,
    tags: r.Tags ? r.Tags.split(",").filter(Boolean) : [],
    intervalSeconds: r.IntervalSeconds,
    timeoutMs: r.TimeoutMs,
    failureConfirmCount: r.FailureConfirmCount,
    recoveryConfirmCount: r.RecoveryConfirmCount,
    alertPolicyId: r.AlertPolicyId,
    status: r.Status,
    consecutiveFailures: r.ConsecutiveFailures,
    consecutiveSuccesses: r.ConsecutiveSuccesses,
    isActive: r.IsActive,
    lastCheckedAt: r.LastCheckedAt,
    nextCheckAt: r.NextCheckAt,
    createdAt: r.CreatedAt,
    config: {
      monitorId: r.Id,
      url: r.Url,
      httpMethod: r.HttpMethod,
      expectedStatusCode: r.ExpectedStatusCode,
      followRedirects: r.FollowRedirects,
      maxRedirects: r.MaxRedirects,
      sslVerify: r.SslVerify,
      expectedKeyword: r.ExpectedKeyword,
      forbiddenKeyword: r.ForbiddenKeyword,
      responseTimeWarningMs: r.ResponseTimeWarningMs,
      responseTimeCriticalMs: r.ResponseTimeCriticalMs,
      alertEmail: r.AlertEmail,
    },
  };
}

export async function listWebsiteMonitors(): Promise<WebsiteMonitorRow[]> {
  const db = await getDb();
  const result = await db.query<JoinedRow>(JOIN_SELECT + " ORDER BY m.Name ASC");
  return result.recordset.map(toRow);
}

export async function loadWebsiteMonitorById(id: number): Promise<WebsiteMonitorRow | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<JoinedRow>(JOIN_SELECT + " AND m.Id = @id");
  const row = result.recordset[0];
  return row ? toRow(row) : null;
}

// ORDER BY NextCheckAt ASC matters once due-count exceeds what one pass can finish in its
// scheduled window (confirmed live: a backlog of 29+ due monitors) - without it, rows come
// back in roughly ascending-Id order, so brand-new monitors (always the highest Id) sit
// permanently at the back of every pass and never get processed while a backlog persists. This
// way whichever monitor has been overdue longest - old or new - is always processed first, so
// the backlog drains fairly instead of starving new monitors indefinitely.
export async function listDueWebsiteMonitors(): Promise<WebsiteMonitorRow[]> {
  const db = await getDb();
  const result = await db.query<JoinedRow>(
    JOIN_SELECT + " AND m.IsActive = 1 AND m.Status NOT IN ('Paused', 'Maintenance') AND m.NextCheckAt <= SYSUTCDATETIME() ORDER BY m.NextCheckAt ASC"
  );
  return result.recordset.map(toRow);
}

// Shared by the plain create route and the "import from the existing Websites list" route -
// both end up creating one Monitor + one WebsiteMonitorConfig row from the same validated
// shape (createWebsiteMonitorSchema output), just sourced from a different form.
export async function insertWebsiteMonitor(p: z.infer<typeof createWebsiteMonitorSchema>, createdByUserId: number): Promise<number> {
  const db = await getDb();
  const nextCheckAt = new Date();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description ?? null)
    .input("environment", sql.VarChar, p.environment ?? null)
    .input("tags", sql.NVarChar, p.tags.join(","))
    .input("intervalSeconds", sql.Int, p.intervalSeconds)
    .input("timeoutMs", sql.Int, p.timeoutMs)
    .input("failureConfirmCount", sql.Int, p.failureConfirmCount)
    .input("recoveryConfirmCount", sql.Int, p.recoveryConfirmCount)
    .input("alertPolicyId", sql.Int, p.alertPolicyId ?? null)
    .input("isActive", sql.Bit, p.isActive)
    .input("nextCheckAt", sql.DateTime2, nextCheckAt)
    .input("createdByUserId", sql.Int, createdByUserId)
    .query<{ Id: number }>(`
      INSERT INTO Monitors (MonitorType, Name, Description, Environment, Tags, IntervalSeconds, TimeoutMs,
        FailureConfirmCount, RecoveryConfirmCount, AlertPolicyId, IsActive, NextCheckAt, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES ('Website', @name, @description, @environment, @tags, @intervalSeconds, @timeoutMs,
        @failureConfirmCount, @recoveryConfirmCount, @alertPolicyId, @isActive, @nextCheckAt, @createdByUserId)
    `);
  const monitorId = inserted.recordset[0].Id;

  await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .input("url", sql.NVarChar, p.url)
    .input("httpMethod", sql.VarChar, p.httpMethod)
    .input("expectedStatusCode", sql.Int, p.expectedStatusCode)
    .input("followRedirects", sql.Bit, p.followRedirects)
    .input("maxRedirects", sql.Int, p.maxRedirects)
    .input("sslVerify", sql.Bit, p.sslVerify)
    .input("expectedKeyword", sql.NVarChar, p.expectedKeyword ?? null)
    .input("forbiddenKeyword", sql.NVarChar, p.forbiddenKeyword ?? null)
    .input("responseTimeWarningMs", sql.Int, p.responseTimeWarningMs)
    .input("responseTimeCriticalMs", sql.Int, p.responseTimeCriticalMs)
    .input("alertEmail", sql.NVarChar, p.alertEmail ?? null)
    .query(`
      INSERT INTO WebsiteMonitorConfigs (MonitorId, Url, HttpMethod, ExpectedStatusCode, FollowRedirects, MaxRedirects,
        SslVerify, ExpectedKeyword, ForbiddenKeyword, ResponseTimeWarningMs, ResponseTimeCriticalMs, AlertEmail)
      VALUES (@monitorId, @url, @httpMethod, @expectedStatusCode, @followRedirects, @maxRedirects,
        @sslVerify, @expectedKeyword, @forbiddenKeyword, @responseTimeWarningMs, @responseTimeCriticalMs, @alertEmail)
    `);

  return monitorId;
}

export interface WebsiteMonitorReportRow {
  id: number;
  name: string;
  url: string;
  environment: string | null;
  status: MonitorStatus;
  lastCheckedAt: string | null;
  lastResponseMs: number | null;
  uptimePercent7d: number | null;
  openIncidents: number;
}

// One row per Website monitor for the "Email Report" feature - last response time and 7-day
// uptime% come from MonitorResults (not part of JOIN_SELECT/WebsiteMonitorRow above, which is
// config-focused), each computed with an OUTER APPLY so a monitor with zero results yet still
// gets a row (nulls) rather than being dropped by an inner join.
export async function listWebsiteMonitorsForReport(): Promise<WebsiteMonitorReportRow[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Url: string;
    Environment: string | null;
    Status: MonitorStatus;
    LastCheckedAt: string | null;
    LastResponseMs: number | null;
    UptimeTotal: number;
    UptimeSuccessful: number;
    OpenIncidents: number;
  }>(`
    SELECT
      m.Id, m.Name, w.Url, m.Environment, m.Status,
      CONVERT(VARCHAR(33), m.LastCheckedAt, 126) AS LastCheckedAt,
      latest.TotalMs AS LastResponseMs,
      ISNULL(uptime.Total, 0) AS UptimeTotal,
      ISNULL(uptime.Successful, 0) AS UptimeSuccessful,
      ISNULL(incidents.OpenCount, 0) AS OpenIncidents
    FROM Monitors m
    JOIN WebsiteMonitorConfigs w ON w.MonitorId = m.Id
    OUTER APPLY (
      SELECT TOP 1 r.TotalMs FROM MonitorResults r WHERE r.MonitorId = m.Id ORDER BY r.CheckedAt DESC
    ) latest
    OUTER APPLY (
      SELECT COUNT(*) AS Total, SUM(CASE WHEN r2.Success = 1 THEN 1 ELSE 0 END) AS Successful
      FROM MonitorResults r2 WHERE r2.MonitorId = m.Id AND r2.CheckedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())
    ) uptime
    OUTER APPLY (
      SELECT COUNT(*) AS OpenCount FROM Incidents i WHERE i.MonitorId = m.Id AND i.Status = 'Open'
    ) incidents
    WHERE m.MonitorType = 'Website' AND m.IsDeleted = 0
    ORDER BY m.Name ASC
  `);

  return result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    url: r.Url,
    environment: r.Environment,
    status: r.Status,
    lastCheckedAt: r.LastCheckedAt,
    lastResponseMs: r.LastResponseMs,
    uptimePercent7d: r.UptimeTotal > 0 ? (r.UptimeSuccessful / r.UptimeTotal) * 100 : null,
    openIncidents: r.OpenIncidents,
  }));
}

// API-monitor equivalent of listWebsiteMonitorsForReport() above - same shape (deliberately
// reuses WebsiteMonitorReportRow rather than a parallel ApiMonitorReportRow type, since Phase 4
// reporting treats both monitor types identically: one combined report, not two separate ones).
export async function listApiMonitorsForReport(): Promise<WebsiteMonitorReportRow[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    Url: string;
    Environment: string | null;
    Status: MonitorStatus;
    LastCheckedAt: string | null;
    LastResponseMs: number | null;
    UptimeTotal: number;
    UptimeSuccessful: number;
    OpenIncidents: number;
  }>(`
    SELECT
      m.Id, m.Name, a.Url, m.Environment, m.Status,
      CONVERT(VARCHAR(33), m.LastCheckedAt, 126) AS LastCheckedAt,
      latest.TotalMs AS LastResponseMs,
      ISNULL(uptime.Total, 0) AS UptimeTotal,
      ISNULL(uptime.Successful, 0) AS UptimeSuccessful,
      ISNULL(incidents.OpenCount, 0) AS OpenIncidents
    FROM Monitors m
    JOIN ApiMonitorConfigs a ON a.MonitorId = m.Id
    OUTER APPLY (
      SELECT TOP 1 r.TotalMs FROM MonitorResults r WHERE r.MonitorId = m.Id ORDER BY r.CheckedAt DESC
    ) latest
    OUTER APPLY (
      SELECT COUNT(*) AS Total, SUM(CASE WHEN r2.Success = 1 THEN 1 ELSE 0 END) AS Successful
      FROM MonitorResults r2 WHERE r2.MonitorId = m.Id AND r2.CheckedAt >= DATEADD(DAY, -7, SYSUTCDATETIME())
    ) uptime
    OUTER APPLY (
      SELECT COUNT(*) AS OpenCount FROM Incidents i WHERE i.MonitorId = m.Id AND i.Status = 'Open'
    ) incidents
    WHERE m.MonitorType = 'Api' AND m.IsDeleted = 0
    ORDER BY m.Name ASC
  `);

  return result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    url: r.Url,
    environment: r.Environment,
    status: r.Status,
    lastCheckedAt: r.LastCheckedAt,
    lastResponseMs: r.LastResponseMs,
    uptimePercent7d: r.UptimeTotal > 0 ? (r.UptimeSuccessful / r.UptimeTotal) * 100 : null,
    openIncidents: r.OpenIncidents,
  }));
}

// Existing monitored URLs, for de-duplicating the "import from Websites" picker so an
// already-monitored site doesn't show up as a candidate a second time.
export async function listMonitoredUrls(): Promise<Set<string>> {
  const db = await getDb();
  const result = await db.query<{ Url: string }>(`
    SELECT w.Url FROM WebsiteMonitorConfigs w JOIN Monitors m ON m.Id = w.MonitorId WHERE m.IsDeleted = 0
  `);
  return new Set(result.recordset.map((r) => r.Url.toLowerCase()));
}

// --- API Monitors (Phase 2) ---

export interface ApiMonitorRow {
  id: number;
  name: string;
  description: string | null;
  environment: string | null;
  tags: string[];
  intervalSeconds: number;
  timeoutMs: number;
  failureConfirmCount: number;
  recoveryConfirmCount: number;
  alertPolicyId: number | null;
  status: MonitorStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  isActive: boolean;
  lastCheckedAt: Date | null;
  nextCheckAt: Date;
  createdAt: Date;
  config: ApiMonitorConfig;
}

interface JoinedApiRow {
  Id: number;
  Name: string;
  Description: string | null;
  Environment: string | null;
  Tags: string | null;
  IntervalSeconds: number;
  TimeoutMs: number;
  FailureConfirmCount: number;
  RecoveryConfirmCount: number;
  AlertPolicyId: number | null;
  Status: MonitorStatus;
  ConsecutiveFailures: number;
  ConsecutiveSuccesses: number;
  IsActive: boolean;
  LastCheckedAt: Date | null;
  NextCheckAt: Date;
  CreatedAt: Date;
  Url: string;
  HttpMethod: ApiMonitorConfig["httpMethod"];
  HeadersJson: string | null;
  QueryParamsJson: string | null;
  RequestBody: string | null;
  RequestBodyContentType: string | null;
  AuthType: ApiMonitorConfig["authType"];
  AuthConfigEncrypted: string | null;
  ExpectedStatusCode: number;
  FollowRedirects: boolean;
  MaxRedirects: number;
  SslVerify: boolean;
  AssertionsJson: string | null;
  ResponseTimeWarningMs: number;
  ResponseTimeCriticalMs: number;
  AlertEmail: string | null;
}

// Same raw-DATETIME2 fix as JOIN_SELECT above - see its comment.
const JOIN_SELECT_API = `
  SELECT m.Id, m.Name, m.Description, m.Environment, m.Tags, m.IntervalSeconds, m.TimeoutMs,
    m.FailureConfirmCount, m.RecoveryConfirmCount, m.AlertPolicyId, m.Status,
    m.ConsecutiveFailures, m.ConsecutiveSuccesses, m.IsActive,
    m.LastCheckedAt, m.NextCheckAt, m.CreatedAt,
    a.Url, a.HttpMethod, a.HeadersJson, a.QueryParamsJson, a.RequestBody, a.RequestBodyContentType,
    a.AuthType, a.AuthConfigEncrypted, a.ExpectedStatusCode, a.FollowRedirects, a.MaxRedirects, a.SslVerify,
    a.AssertionsJson, a.ResponseTimeWarningMs, a.ResponseTimeCriticalMs, a.AlertEmail
  FROM Monitors m
  JOIN ApiMonitorConfigs a ON a.MonitorId = m.Id
  WHERE m.MonitorType = 'Api' AND m.IsDeleted = 0
`;

function toApiRow(r: JoinedApiRow): ApiMonitorRow {
  return {
    id: r.Id,
    name: r.Name,
    description: r.Description,
    environment: r.Environment,
    tags: r.Tags ? r.Tags.split(",").filter(Boolean) : [],
    intervalSeconds: r.IntervalSeconds,
    timeoutMs: r.TimeoutMs,
    failureConfirmCount: r.FailureConfirmCount,
    recoveryConfirmCount: r.RecoveryConfirmCount,
    alertPolicyId: r.AlertPolicyId,
    status: r.Status,
    consecutiveFailures: r.ConsecutiveFailures,
    consecutiveSuccesses: r.ConsecutiveSuccesses,
    isActive: r.IsActive,
    lastCheckedAt: r.LastCheckedAt,
    nextCheckAt: r.NextCheckAt,
    createdAt: r.CreatedAt,
    config: {
      monitorId: r.Id,
      url: r.Url,
      httpMethod: r.HttpMethod,
      headers: r.HeadersJson ? (JSON.parse(r.HeadersJson) as ApiHeader[]) : [],
      queryParams: r.QueryParamsJson ? (JSON.parse(r.QueryParamsJson) as ApiHeader[]) : [],
      requestBody: r.RequestBody,
      requestBodyContentType: r.RequestBodyContentType,
      authType: r.AuthType,
      authConfig: decryptApiAuthConfig(r.AuthConfigEncrypted),
      expectedStatusCode: r.ExpectedStatusCode,
      followRedirects: r.FollowRedirects,
      maxRedirects: r.MaxRedirects,
      sslVerify: r.SslVerify,
      assertions: r.AssertionsJson ? (JSON.parse(r.AssertionsJson) as ApiAssertion[]) : [],
      responseTimeWarningMs: r.ResponseTimeWarningMs,
      responseTimeCriticalMs: r.ResponseTimeCriticalMs,
      alertEmail: r.AlertEmail,
    },
  };
}

export async function listApiMonitors(): Promise<ApiMonitorRow[]> {
  const db = await getDb();
  const result = await db.query<JoinedApiRow>(JOIN_SELECT_API + " ORDER BY m.Name ASC");
  return result.recordset.map(toApiRow);
}

export async function loadApiMonitorById(id: number): Promise<ApiMonitorRow | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<JoinedApiRow>(JOIN_SELECT_API + " AND m.Id = @id");
  const row = result.recordset[0];
  return row ? toApiRow(row) : null;
}

// Same fairness fix as listDueWebsiteMonitors' ORDER BY - see its comment.
export async function listDueApiMonitors(): Promise<ApiMonitorRow[]> {
  const db = await getDb();
  const result = await db.query<JoinedApiRow>(
    JOIN_SELECT_API + " AND m.IsActive = 1 AND m.Status NOT IN ('Paused', 'Maintenance') AND m.NextCheckAt <= SYSUTCDATETIME() ORDER BY m.NextCheckAt ASC"
  );
  return result.recordset.map(toApiRow);
}

export async function insertApiMonitor(p: z.infer<typeof createApiMonitorSchema>, createdByUserId: number): Promise<number> {
  const db = await getDb();
  const nextCheckAt = new Date();
  const inserted = await db
    .request()
    .input("name", sql.NVarChar, p.name)
    .input("description", sql.NVarChar, p.description ?? null)
    .input("environment", sql.VarChar, p.environment ?? null)
    .input("tags", sql.NVarChar, p.tags.join(","))
    .input("intervalSeconds", sql.Int, p.intervalSeconds)
    .input("timeoutMs", sql.Int, p.timeoutMs)
    .input("failureConfirmCount", sql.Int, p.failureConfirmCount)
    .input("recoveryConfirmCount", sql.Int, p.recoveryConfirmCount)
    .input("alertPolicyId", sql.Int, p.alertPolicyId ?? null)
    .input("isActive", sql.Bit, p.isActive)
    .input("nextCheckAt", sql.DateTime2, nextCheckAt)
    .input("createdByUserId", sql.Int, createdByUserId)
    .query<{ Id: number }>(`
      INSERT INTO Monitors (MonitorType, Name, Description, Environment, Tags, IntervalSeconds, TimeoutMs,
        FailureConfirmCount, RecoveryConfirmCount, AlertPolicyId, IsActive, NextCheckAt, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES ('Api', @name, @description, @environment, @tags, @intervalSeconds, @timeoutMs,
        @failureConfirmCount, @recoveryConfirmCount, @alertPolicyId, @isActive, @nextCheckAt, @createdByUserId)
    `);
  const monitorId = inserted.recordset[0].Id;

  await db
    .request()
    .input("monitorId", sql.Int, monitorId)
    .input("url", sql.NVarChar, p.url)
    .input("httpMethod", sql.VarChar, p.httpMethod)
    .input("headersJson", sql.NVarChar(sql.MAX), JSON.stringify(p.headers))
    .input("queryParamsJson", sql.NVarChar(sql.MAX), JSON.stringify(p.queryParams))
    .input("requestBody", sql.NVarChar(sql.MAX), p.requestBody ?? null)
    .input("requestBodyContentType", sql.VarChar, p.requestBodyContentType ?? "application/json")
    .input("authType", sql.VarChar, p.authType)
    .input("authConfigEncrypted", sql.NVarChar(sql.MAX), encryptApiAuthConfig(p.authConfig))
    .input("expectedStatusCode", sql.Int, p.expectedStatusCode)
    .input("followRedirects", sql.Bit, p.followRedirects)
    .input("maxRedirects", sql.Int, p.maxRedirects)
    .input("sslVerify", sql.Bit, p.sslVerify)
    .input("assertionsJson", sql.NVarChar(sql.MAX), JSON.stringify(p.assertions))
    .input("responseTimeWarningMs", sql.Int, p.responseTimeWarningMs)
    .input("responseTimeCriticalMs", sql.Int, p.responseTimeCriticalMs)
    .input("alertEmail", sql.NVarChar, p.alertEmail ?? null)
    .query(`
      INSERT INTO ApiMonitorConfigs (MonitorId, Url, HttpMethod, HeadersJson, QueryParamsJson, RequestBody, RequestBodyContentType,
        AuthType, AuthConfigEncrypted, ExpectedStatusCode, FollowRedirects, MaxRedirects, SslVerify, AssertionsJson,
        ResponseTimeWarningMs, ResponseTimeCriticalMs, AlertEmail)
      VALUES (@monitorId, @url, @httpMethod, @headersJson, @queryParamsJson, @requestBody, @requestBodyContentType,
        @authType, @authConfigEncrypted, @expectedStatusCode, @followRedirects, @maxRedirects, @sslVerify, @assertionsJson,
        @responseTimeWarningMs, @responseTimeCriticalMs, @alertEmail)
    `);

  return monitorId;
}

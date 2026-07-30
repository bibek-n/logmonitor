import { getDb, sql } from "../db";
import {
  VulnerabilityFinding,
  VulnerabilityFindingDraft,
  VulnerabilityFindingStatus,
  VulnerabilityScan,
  VulnerabilityScanStatus,
  WafCountryRule,
  WafCustomRule,
  WafRateLimitRule,
} from "./types";
import type { z } from "zod";
import type {
  createWafCountryRuleSchema,
  createWafCustomRuleSchema,
  createWafRateLimitRuleSchema,
  updateVulnerabilityFindingSchema,
  updateWafCountryRuleSchema,
  updateWafCustomRuleSchema,
  updateWafRateLimitRuleSchema,
} from "./schema";

// --- Vulnerability Scans / Findings ---------------------------------------------------------

export async function createScan(opts: {
  websiteId: number | null;
  targetUrl: string;
  isAdHocTarget: boolean;
  authorizedByUserId: number | null;
  requestedByUserId: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, opts.websiteId)
    .input("targetUrl", sql.NVarChar, opts.targetUrl)
    .input("isAdHocTarget", sql.Bit, opts.isAdHocTarget)
    .input("authorizedByUserId", sql.Int, opts.authorizedByUserId)
    .input("requestedByUserId", sql.Int, opts.requestedByUserId)
    .query<{ Id: number }>(`
      INSERT INTO VulnerabilityScans (WebsiteId, TargetUrl, IsAdHocTarget, AuthorizedByUserId, RequestedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@websiteId, @targetUrl, @isAdHocTarget, @authorizedByUserId, @requestedByUserId)
    `);
  return result.recordset[0].Id;
}

export async function updateScanStatus(
  scanId: number,
  status: VulnerabilityScanStatus,
  extra: { startedAt?: Date; completedAt?: Date; checksRun?: number } = {}
): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("id", sql.Int, scanId)
    .input("status", sql.VarChar, status)
    .input("startedAt", sql.DateTime2, extra.startedAt ?? null)
    .input("completedAt", sql.DateTime2, extra.completedAt ?? null)
    .input("checksRun", sql.Int, extra.checksRun ?? null)
    .query(`
      UPDATE VulnerabilityScans
      SET Status = @status,
        StartedAt = COALESCE(@startedAt, StartedAt),
        CompletedAt = COALESCE(@completedAt, CompletedAt),
        ChecksRun = COALESCE(@checksRun, ChecksRun)
      WHERE Id = @id
    `);
}

function mapScan(r: {
  Id: number;
  WebsiteId: number | null;
  TargetUrl: string;
  IsAdHocTarget: boolean;
  AuthorizedByUserId: number | null;
  Status: VulnerabilityScanStatus;
  StartedAt: Date | null;
  CompletedAt: Date | null;
  ChecksRun: number;
  RequestedByUserId: number | null;
  CreatedAt: Date;
}): VulnerabilityScan {
  return {
    id: r.Id,
    websiteId: r.WebsiteId,
    targetUrl: r.TargetUrl,
    isAdHocTarget: r.IsAdHocTarget,
    authorizedByUserId: r.AuthorizedByUserId,
    status: r.Status,
    startedAt: r.StartedAt,
    completedAt: r.CompletedAt,
    checksRun: r.ChecksRun,
    requestedByUserId: r.RequestedByUserId,
    createdAt: r.CreatedAt,
  };
}

export async function listScans(limit: number = 100): Promise<VulnerabilityScan[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<{
      Id: number;
      WebsiteId: number | null;
      TargetUrl: string;
      IsAdHocTarget: boolean;
      AuthorizedByUserId: number | null;
      Status: VulnerabilityScanStatus;
      StartedAt: Date | null;
      CompletedAt: Date | null;
      ChecksRun: number;
      RequestedByUserId: number | null;
      CreatedAt: Date;
    }>(
      "SELECT TOP (@limit) Id, WebsiteId, TargetUrl, IsAdHocTarget, AuthorizedByUserId, Status, StartedAt, CompletedAt, ChecksRun, RequestedByUserId, CreatedAt FROM VulnerabilityScans ORDER BY CreatedAt DESC"
    );
  return result.recordset.map(mapScan);
}

function mapFinding(r: {
  Id: number;
  ScanId: number;
  CheckType: string;
  Severity: string;
  CvssScore: number | null;
  Cwe: string | null;
  Cve: string | null;
  Title: string;
  Description: string | null;
  Risk: string | null;
  Evidence: string | null;
  AffectedUrl: string | null;
  Parameter: string | null;
  HttpRequestSnippet: string | null;
  HttpResponseSnippet: string | null;
  Remediation: string | null;
  ReferencesJson: string | null;
  Status: string;
  AssignedEngineerUserId: number | null;
  Notes: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}): VulnerabilityFinding {
  return {
    id: r.Id,
    scanId: r.ScanId,
    checkType: r.CheckType as VulnerabilityFinding["checkType"],
    severity: r.Severity as VulnerabilityFinding["severity"],
    cvssScore: r.CvssScore,
    cwe: r.Cwe,
    cve: r.Cve,
    title: r.Title,
    description: r.Description ?? "",
    risk: r.Risk ?? "",
    evidence: r.Evidence ?? "",
    affectedUrl: r.AffectedUrl ?? "",
    parameter: r.Parameter,
    httpRequestSnippet: r.HttpRequestSnippet,
    httpResponseSnippet: r.HttpResponseSnippet,
    remediation: r.Remediation ?? "",
    references: r.ReferencesJson ? JSON.parse(r.ReferencesJson) : [],
    status: r.Status as VulnerabilityFindingStatus,
    assignedEngineerUserId: r.AssignedEngineerUserId,
    notes: r.Notes,
    createdAt: r.CreatedAt,
    updatedAt: r.UpdatedAt,
  };
}

export async function insertVulnerabilityFinding(scanId: number, f: VulnerabilityFindingDraft): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("scanId", sql.Int, scanId)
    .input("checkType", sql.VarChar, f.checkType)
    .input("severity", sql.VarChar, f.severity)
    .input("cvssScore", sql.Decimal(3, 1), f.cvssScore)
    .input("cwe", sql.VarChar, f.cwe)
    .input("cve", sql.VarChar, f.cve)
    .input("title", sql.NVarChar, f.title)
    .input("description", sql.NVarChar(sql.MAX), f.description)
    .input("risk", sql.NVarChar(sql.MAX), f.risk)
    .input("evidence", sql.NVarChar(sql.MAX), f.evidence)
    .input("affectedUrl", sql.NVarChar, f.affectedUrl)
    .input("parameter", sql.NVarChar, f.parameter)
    .input("httpRequestSnippet", sql.NVarChar(sql.MAX), f.httpRequestSnippet)
    .input("httpResponseSnippet", sql.NVarChar(sql.MAX), f.httpResponseSnippet)
    .input("remediation", sql.NVarChar(sql.MAX), f.remediation)
    .input("referencesJson", sql.NVarChar(sql.MAX), JSON.stringify(f.references))
    .query(`
      INSERT INTO VulnerabilityFindings
        (ScanId, CheckType, Severity, CvssScore, Cwe, Cve, Title, Description, Risk, Evidence, AffectedUrl, Parameter,
         HttpRequestSnippet, HttpResponseSnippet, Remediation, ReferencesJson)
      VALUES
        (@scanId, @checkType, @severity, @cvssScore, @cwe, @cve, @title, @description, @risk, @evidence, @affectedUrl, @parameter,
         @httpRequestSnippet, @httpResponseSnippet, @remediation, @referencesJson)
    `);
}

export async function getScanWithFindings(scanId: number): Promise<VulnerabilityScan | null> {
  const db = await getDb();
  const scanResult = await db
    .request()
    .input("id", sql.Int, scanId)
    .query<{
      Id: number;
      WebsiteId: number | null;
      TargetUrl: string;
      IsAdHocTarget: boolean;
      AuthorizedByUserId: number | null;
      Status: VulnerabilityScanStatus;
      StartedAt: Date | null;
      CompletedAt: Date | null;
      ChecksRun: number;
      RequestedByUserId: number | null;
      CreatedAt: Date;
    }>(
      "SELECT Id, WebsiteId, TargetUrl, IsAdHocTarget, AuthorizedByUserId, Status, StartedAt, CompletedAt, ChecksRun, RequestedByUserId, CreatedAt FROM VulnerabilityScans WHERE Id = @id"
    );
  const row = scanResult.recordset[0];
  if (!row) return null;

  const findingsResult = await db.request().input("scanId", sql.Int, scanId).query<{
    Id: number;
    ScanId: number;
    CheckType: string;
    Severity: string;
    CvssScore: number | null;
    Cwe: string | null;
    Cve: string | null;
    Title: string;
    Description: string | null;
    Risk: string | null;
    Evidence: string | null;
    AffectedUrl: string | null;
    Parameter: string | null;
    HttpRequestSnippet: string | null;
    HttpResponseSnippet: string | null;
    Remediation: string | null;
    ReferencesJson: string | null;
    Status: string;
    AssignedEngineerUserId: number | null;
    Notes: string | null;
    CreatedAt: Date;
    UpdatedAt: Date;
  }>(`
    SELECT Id, ScanId, CheckType, Severity, CvssScore, Cwe, Cve, Title, Description, Risk, Evidence, AffectedUrl, Parameter,
      HttpRequestSnippet, HttpResponseSnippet, Remediation, ReferencesJson, Status, AssignedEngineerUserId, Notes, CreatedAt, UpdatedAt
    FROM VulnerabilityFindings WHERE ScanId = @scanId
    ORDER BY CASE Severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 WHEN 'Low' THEN 3 ELSE 4 END, CreatedAt ASC
  `);

  return { ...mapScan(row), findings: findingsResult.recordset.map(mapFinding) };
}

export async function updateFinding(findingId: number, input: z.infer<typeof updateVulnerabilityFindingSchema>): Promise<void> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, findingId)
    .query<{ Status: string; AssignedEngineerUserId: number | null; Notes: string | null }>(
      "SELECT Status, AssignedEngineerUserId, Notes FROM VulnerabilityFindings WHERE Id = @id"
    );
  const current = existing.recordset[0];
  if (!current) throw new Error("Finding not found");

  await db
    .request()
    .input("id", sql.Int, findingId)
    .input("status", sql.VarChar, input.status ?? current.Status)
    .input("assignedEngineerUserId", sql.Int, input.assignedEngineerUserId !== undefined ? input.assignedEngineerUserId : current.AssignedEngineerUserId)
    .input("notes", sql.NVarChar(sql.MAX), input.notes !== undefined ? input.notes : current.Notes)
    .query(`
      UPDATE VulnerabilityFindings
      SET Status = @status, AssignedEngineerUserId = @assignedEngineerUserId, Notes = @notes, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id
    `);
}

// --- WAF rule configuration ------------------------------------------------------------------

function mapRateLimitRule(r: {
  Id: number;
  WebsiteId: number | null;
  Name: string;
  RequestsPerWindow: number;
  WindowSeconds: number;
  Action: string;
  IsActive: boolean;
  CreatedAt: Date;
}): WafRateLimitRule {
  return {
    id: r.Id,
    websiteId: r.WebsiteId,
    name: r.Name,
    requestsPerWindow: r.RequestsPerWindow,
    windowSeconds: r.WindowSeconds,
    action: r.Action as WafRateLimitRule["action"],
    isActive: r.IsActive,
    createdAt: r.CreatedAt,
  };
}

export async function listRateLimitRules(): Promise<WafRateLimitRule[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    WebsiteId: number | null;
    Name: string;
    RequestsPerWindow: number;
    WindowSeconds: number;
    Action: string;
    IsActive: boolean;
    CreatedAt: Date;
  }>("SELECT Id, WebsiteId, Name, RequestsPerWindow, WindowSeconds, Action, IsActive, CreatedAt FROM WafRateLimitRules ORDER BY Name ASC");
  return result.recordset.map(mapRateLimitRule);
}

export async function createRateLimitRule(input: z.infer<typeof createWafRateLimitRuleSchema>): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("websiteId", sql.Int, input.websiteId ?? null)
    .input("name", sql.NVarChar, input.name)
    .input("requestsPerWindow", sql.Int, input.requestsPerWindow)
    .input("windowSeconds", sql.Int, input.windowSeconds)
    .input("action", sql.VarChar, input.action)
    .input("isActive", sql.Bit, input.isActive)
    .query<{ Id: number }>(`
      INSERT INTO WafRateLimitRules (WebsiteId, Name, RequestsPerWindow, WindowSeconds, Action, IsActive)
      OUTPUT INSERTED.Id VALUES (@websiteId, @name, @requestsPerWindow, @windowSeconds, @action, @isActive)
    `);
  return result.recordset[0].Id;
}

export async function updateRateLimitRule(id: number, input: z.infer<typeof updateWafRateLimitRuleSchema>): Promise<void> {
  const db = await getDb();
  const existing = await db.request().input("id", sql.Int, id).query<{
    WebsiteId: number | null;
    Name: string;
    RequestsPerWindow: number;
    WindowSeconds: number;
    Action: string;
    IsActive: boolean;
  }>("SELECT WebsiteId, Name, RequestsPerWindow, WindowSeconds, Action, IsActive FROM WafRateLimitRules WHERE Id = @id");
  const current = existing.recordset[0];
  if (!current) throw new Error("Rate limit rule not found");

  await db
    .request()
    .input("id", sql.Int, id)
    .input("websiteId", sql.Int, input.websiteId !== undefined ? input.websiteId : current.WebsiteId)
    .input("name", sql.NVarChar, input.name ?? current.Name)
    .input("requestsPerWindow", sql.Int, input.requestsPerWindow ?? current.RequestsPerWindow)
    .input("windowSeconds", sql.Int, input.windowSeconds ?? current.WindowSeconds)
    .input("action", sql.VarChar, input.action ?? current.Action)
    .input("isActive", sql.Bit, input.isActive ?? current.IsActive)
    .query(
      "UPDATE WafRateLimitRules SET WebsiteId = @websiteId, Name = @name, RequestsPerWindow = @requestsPerWindow, WindowSeconds = @windowSeconds, Action = @action, IsActive = @isActive WHERE Id = @id"
    );
}

export async function deleteRateLimitRule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM WafRateLimitRules WHERE Id = @id");
}

function mapCustomRule(r: { Id: number; Name: string; MatchType: string; MatchValue: string; Action: string; IsActive: boolean; CreatedAt: Date }): WafCustomRule {
  return { id: r.Id, name: r.Name, matchType: r.MatchType as WafCustomRule["matchType"], matchValue: r.MatchValue, action: r.Action as WafCustomRule["action"], isActive: r.IsActive, createdAt: r.CreatedAt };
}

export async function listCustomRules(): Promise<WafCustomRule[]> {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; MatchType: string; MatchValue: string; Action: string; IsActive: boolean; CreatedAt: Date }>(
    "SELECT Id, Name, MatchType, MatchValue, Action, IsActive, CreatedAt FROM WafCustomRules ORDER BY Name ASC"
  );
  return result.recordset.map(mapCustomRule);
}

export async function createCustomRule(input: z.infer<typeof createWafCustomRuleSchema>): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, input.name)
    .input("matchType", sql.VarChar, input.matchType)
    .input("matchValue", sql.NVarChar, input.matchValue)
    .input("action", sql.VarChar, input.action)
    .input("isActive", sql.Bit, input.isActive)
    .query<{ Id: number }>(
      "INSERT INTO WafCustomRules (Name, MatchType, MatchValue, Action, IsActive) OUTPUT INSERTED.Id VALUES (@name, @matchType, @matchValue, @action, @isActive)"
    );
  return result.recordset[0].Id;
}

export async function updateCustomRule(id: number, input: z.infer<typeof updateWafCustomRuleSchema>): Promise<void> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ Name: string; MatchType: string; MatchValue: string; Action: string; IsActive: boolean }>(
      "SELECT Name, MatchType, MatchValue, Action, IsActive FROM WafCustomRules WHERE Id = @id"
    );
  const current = existing.recordset[0];
  if (!current) throw new Error("Custom rule not found");

  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, input.name ?? current.Name)
    .input("matchType", sql.VarChar, input.matchType ?? current.MatchType)
    .input("matchValue", sql.NVarChar, input.matchValue ?? current.MatchValue)
    .input("action", sql.VarChar, input.action ?? current.Action)
    .input("isActive", sql.Bit, input.isActive ?? current.IsActive)
    .query("UPDATE WafCustomRules SET Name = @name, MatchType = @matchType, MatchValue = @matchValue, Action = @action, IsActive = @isActive WHERE Id = @id");
}

export async function deleteCustomRule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM WafCustomRules WHERE Id = @id");
}

function mapCountryRule(r: { Id: number; CountryCode: string; Action: string; IsActive: boolean; CreatedAt: Date }): WafCountryRule {
  return { id: r.Id, countryCode: r.CountryCode, action: r.Action as WafCountryRule["action"], isActive: r.IsActive, createdAt: r.CreatedAt };
}

export async function listCountryRules(): Promise<WafCountryRule[]> {
  const db = await getDb();
  const result = await db.query<{ Id: number; CountryCode: string; Action: string; IsActive: boolean; CreatedAt: Date }>(
    "SELECT Id, CountryCode, Action, IsActive, CreatedAt FROM WafCountryRules ORDER BY CountryCode ASC"
  );
  return result.recordset.map(mapCountryRule);
}

export async function createCountryRule(input: z.infer<typeof createWafCountryRuleSchema>): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("countryCode", sql.Char(2), input.countryCode)
    .input("action", sql.VarChar, input.action)
    .input("isActive", sql.Bit, input.isActive)
    .query<{ Id: number }>("INSERT INTO WafCountryRules (CountryCode, Action, IsActive) OUTPUT INSERTED.Id VALUES (@countryCode, @action, @isActive)");
  return result.recordset[0].Id;
}

export async function updateCountryRule(id: number, input: z.infer<typeof updateWafCountryRuleSchema>): Promise<void> {
  const db = await getDb();
  const existing = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ CountryCode: string; Action: string; IsActive: boolean }>("SELECT CountryCode, Action, IsActive FROM WafCountryRules WHERE Id = @id");
  const current = existing.recordset[0];
  if (!current) throw new Error("Country rule not found");

  await db
    .request()
    .input("id", sql.Int, id)
    .input("countryCode", sql.Char(2), input.countryCode ?? current.CountryCode)
    .input("action", sql.VarChar, input.action ?? current.Action)
    .input("isActive", sql.Bit, input.isActive ?? current.IsActive)
    .query("UPDATE WafCountryRules SET CountryCode = @countryCode, Action = @action, IsActive = @isActive WHERE Id = @id");
}

export async function deleteCountryRule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query("DELETE FROM WafCountryRules WHERE Id = @id");
}

// --- Score snapshots -------------------------------------------------------------------------

export async function insertScoreSnapshot(overallScore: number, componentScores: Record<string, number>): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input("overallScore", sql.Int, overallScore)
    .input("componentScoresJson", sql.NVarChar(sql.MAX), JSON.stringify(componentScores))
    .query("INSERT INTO SecurityCenterScoreSnapshots (OverallScore, ComponentScoresJson) VALUES (@overallScore, @componentScoresJson)");
}

export async function listScoreSnapshots(limit: number = 168): Promise<{ snapshotAt: Date; overallScore: number }[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input("limit", sql.Int, limit)
    .query<{ SnapshotAt: Date; OverallScore: number }>(
      "SELECT TOP (@limit) SnapshotAt, OverallScore FROM SecurityCenterScoreSnapshots ORDER BY SnapshotAt DESC"
    );
  return result.recordset.map((r) => ({ snapshotAt: r.SnapshotAt, overallScore: r.OverallScore })).reverse();
}

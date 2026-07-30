import { getDb, sql } from "../db";
import { matchCategoryRule } from "./classifyDomain";
import { isDomainExcluded } from "./excludedDomainsFilter";
import type {
  BrowserActivityEvent,
  BrowserActivitySettings,
  DomainCategory,
  DomainCategoryRule,
  ExcludedDomain,
  ExcludedDomainReason,
  RawBrowserActivityEvent,
  RiskLevel,
} from "./types";

function mapEvent(r: Record<string, unknown>): BrowserActivityEvent {
  return {
    id: r.Id as number,
    deviceId: r.DeviceId as string,
    staffId: (r.StaffId as number | null) ?? null,
    browser: r.Browser as BrowserActivityEvent["browser"],
    domain: r.Domain as string,
    pageTitle: (r.PageTitle as string | null) ?? null,
    visitedAt: new Date(r.VisitedAt as string),
    dwellSeconds: (r.DwellSeconds as number | null) ?? null,
    categoryId: (r.CategoryId as number | null) ?? null,
    categoryName: (r.CategoryName as string | null) ?? null,
    riskLevel: r.RiskLevel as RiskLevel,
    isSecurityEvent: Boolean(r.IsSecurityEvent),
    securityEventType: (r.SecurityEventType as BrowserActivityEvent["securityEventType"]) ?? null,
    receivedAt: new Date(r.ReceivedAt as string),
  };
}

function mapCategory(r: Record<string, unknown>): DomainCategory {
  return {
    id: r.Id as number,
    name: r.Name as string,
    riskLevel: r.RiskLevel as RiskLevel,
    isBuiltIn: Boolean(r.IsBuiltIn),
  };
}

function mapCategoryRule(r: Record<string, unknown>): DomainCategoryRule {
  return {
    id: r.Id as number,
    domain: r.Domain as string,
    categoryId: r.CategoryId as number,
    matchType: r.MatchType as DomainCategoryRule["matchType"],
    source: r.Source as DomainCategoryRule["source"],
  };
}

function mapExcludedDomain(r: Record<string, unknown>): ExcludedDomain {
  return {
    id: r.Id as number,
    domain: r.Domain as string,
    reason: r.Reason as ExcludedDomainReason,
    notes: (r.Notes as string | null) ?? null,
  };
}

// --- Settings (singleton) -----------------------------------------------------------------

export async function getBrowserActivitySettings(): Promise<BrowserActivitySettings> {
  const db = await getDb();
  const result = await db.query`SELECT RetentionDays, CollectPageTitles, DefaultIntervalMinutes FROM BrowserActivitySettings WHERE Id = 1`;
  const row = result.recordset[0];
  return {
    retentionDays: row.RetentionDays,
    collectPageTitles: Boolean(row.CollectPageTitles),
    defaultIntervalMinutes: row.DefaultIntervalMinutes,
  };
}

export async function updateBrowserActivitySettings(patch: Partial<BrowserActivitySettings>, updatedByUserId: number): Promise<void> {
  const db = await getDb();
  const current = await getBrowserActivitySettings();
  const merged = { ...current, ...patch };
  await db
    .request()
    .input("retentionDays", sql.Int, merged.retentionDays)
    .input("collectPageTitles", sql.Bit, merged.collectPageTitles)
    .input("defaultIntervalMinutes", sql.Int, merged.defaultIntervalMinutes)
    .input("updatedByUserId", sql.Int, updatedByUserId)
    .query(`
      UPDATE BrowserActivitySettings SET
        RetentionDays = @retentionDays, CollectPageTitles = @collectPageTitles,
        DefaultIntervalMinutes = @defaultIntervalMinutes,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);
}

// --- Domain Categories & Rules -------------------------------------------------------------

export async function listCategories(): Promise<DomainCategory[]> {
  const db = await getDb();
  const result = await db.query`SELECT * FROM DomainCategories ORDER BY Name ASC`;
  return result.recordset.map(mapCategory);
}

export async function createCategory(data: { name: string; riskLevel: RiskLevel }): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("name", sql.NVarChar, data.name)
    .input("riskLevel", sql.VarChar, data.riskLevel)
    .query(`INSERT INTO DomainCategories (Name, RiskLevel, IsBuiltIn) OUTPUT INSERTED.Id VALUES (@name, @riskLevel, 0)`);
  return result.recordset[0].Id;
}

export async function updateCategory(id: number, data: { name?: string; riskLevel?: RiskLevel }): Promise<void> {
  const db = await getDb();
  const current = await db.request().input("id", sql.Int, id).query(`SELECT * FROM DomainCategories WHERE Id = @id`);
  if (!current.recordset[0]) return;
  const merged = { ...mapCategory(current.recordset[0]), ...data };
  await db
    .request()
    .input("id", sql.Int, id)
    .input("name", sql.NVarChar, merged.name)
    .input("riskLevel", sql.VarChar, merged.riskLevel)
    .query(`UPDATE DomainCategories SET Name = @name, RiskLevel = @riskLevel, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id`);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  // IsBuiltIn categories (Business/Social Media/etc.) cannot be removed - only their rules can change.
  await db.request().input("id", sql.Int, id).query(`DELETE FROM DomainCategories WHERE Id = @id AND IsBuiltIn = 0`);
}

export async function listCategoryRules(): Promise<(DomainCategoryRule & { categoryName: string })[]> {
  const db = await getDb();
  const result = await db.query`
    SELECT r.*, c.Name AS CategoryName FROM DomainCategoryRules r JOIN DomainCategories c ON c.Id = r.CategoryId
    ORDER BY r.Domain ASC
  `;
  return result.recordset.map((r: Record<string, unknown>) => ({ ...mapCategoryRule(r), categoryName: r.CategoryName as string }));
}

export async function createCategoryRule(data: {
  domain: string;
  categoryId: number;
  matchType: "exact" | "suffix";
  createdByUserId: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("domain", sql.NVarChar, data.domain.toLowerCase())
    .input("categoryId", sql.Int, data.categoryId)
    .input("matchType", sql.VarChar, data.matchType)
    .input("createdByUserId", sql.Int, data.createdByUserId)
    .query(`
      INSERT INTO DomainCategoryRules (Domain, CategoryId, MatchType, Source, CreatedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@domain, @categoryId, @matchType, 'manual', @createdByUserId)
    `);
  return result.recordset[0].Id;
}

export async function deleteCategoryRule(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`DELETE FROM DomainCategoryRules WHERE Id = @id`);
}

// --- Excluded Domains -----------------------------------------------------------------------

export async function listExcludedDomains(): Promise<ExcludedDomain[]> {
  const db = await getDb();
  const result = await db.query`SELECT * FROM ExcludedDomains ORDER BY Domain ASC`;
  return result.recordset.map(mapExcludedDomain);
}

// Bare list of domain strings, for pushing to the agent via the heartbeat response - this is
// the agent-side pre-filter list (the primary enforcement point, see excludedDomainsFilter.ts).
export async function listExcludedDomainStrings(): Promise<string[]> {
  const db = await getDb();
  const result = await db.query`SELECT Domain FROM ExcludedDomains`;
  return result.recordset.map((r: { Domain: string }) => r.Domain);
}

export async function createExcludedDomain(data: {
  domain: string;
  reason: ExcludedDomainReason;
  notes: string | null;
  addedByUserId: number;
}): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("domain", sql.NVarChar, data.domain.toLowerCase())
    .input("reason", sql.VarChar, data.reason)
    .input("notes", sql.NVarChar, data.notes)
    .input("addedByUserId", sql.Int, data.addedByUserId)
    .query(`
      INSERT INTO ExcludedDomains (Domain, Reason, Notes, AddedByUserId)
      OUTPUT INSERTED.Id
      VALUES (@domain, @reason, @notes, @addedByUserId)
    `);
  return result.recordset[0].Id;
}

export async function deleteExcludedDomain(id: number): Promise<void> {
  const db = await getDb();
  await db.request().input("id", sql.Int, id).query(`DELETE FROM ExcludedDomains WHERE Id = @id`);
}

// --- Ingest (agent-facing) -------------------------------------------------------------------

// Server-side re-validation of the domain field, independent of what the agent claims to have
// sent - defense-in-depth against a buggy or compromised agent build (see the threat model in
// the approved plan). Rejects anything that looks like it carries a path/query/fragment rather
// than a bare registrable domain.
function isBareDomain(value: string): boolean {
  if (!value || value.length > 255) return false;
  if (/[\/\?\#\s]/.test(value)) return false;
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

export async function ingestBrowserActivityEvents(deviceId: string, staffId: number | null, rawEvents: RawBrowserActivityEvent[]): Promise<number> {
  const db = await getDb();

  const [excludedDomains, categoryRulesRaw, settings] = await Promise.all([
    listExcludedDomainStrings(),
    db.query`SELECT * FROM DomainCategoryRules`,
    getBrowserActivitySettings(),
  ]);
  const categoryRules = categoryRulesRaw.recordset.map(mapCategoryRule);
  const categoriesResult = await db.query`SELECT * FROM DomainCategories`;
  const categoriesById = new Map(categoriesResult.recordset.map((c: Record<string, unknown>) => [c.Id as number, mapCategory(c)]));

  let inserted = 0;
  for (const event of rawEvents) {
    const domain = event.domain.trim().toLowerCase();
    if (!isBareDomain(domain)) continue; // reject anything path-shaped, regardless of what the agent sent
    if (isDomainExcluded(domain, excludedDomains)) continue; // server-side re-check, agent already filtered these

    const matchedRule = matchCategoryRule(domain, categoryRules);
    const category = matchedRule ? categoriesById.get(matchedRule.categoryId) : null;
    const riskLevel: RiskLevel = category?.riskLevel ?? "none";
    const isSecurityEvent = riskLevel === "high";
    const pageTitle = settings.collectPageTitles ? event.pageTitle : null;

    await db
      .request()
      .input("deviceId", sql.VarChar, deviceId)
      .input("staffId", sql.Int, staffId)
      .input("browser", sql.VarChar, event.browser)
      .input("domain", sql.NVarChar, domain)
      .input("pageTitle", sql.NVarChar, pageTitle)
      .input("visitedAt", sql.DateTime2, new Date(event.visitedAt))
      .input("dwellSeconds", sql.Int, event.dwellSeconds)
      .input("categoryId", sql.Int, matchedRule?.categoryId ?? null)
      .input("riskLevel", sql.VarChar, riskLevel)
      .input("isSecurityEvent", sql.Bit, isSecurityEvent)
      .input("securityEventType", sql.VarChar, isSecurityEvent ? "blocked_domain" : null)
      .query(`
        INSERT INTO BrowserActivityEvents
          (DeviceId, StaffId, Browser, Domain, PageTitle, VisitedAt, DwellSeconds, CategoryId, RiskLevel, IsSecurityEvent, SecurityEventType)
        VALUES
          (@deviceId, @staffId, @browser, @domain, @pageTitle, @visitedAt, @dwellSeconds, @categoryId, @riskLevel, @isSecurityEvent, @securityEventType)
      `);
    inserted++;
  }
  return inserted;
}

// --- Events list (admin-facing) ---------------------------------------------------------------

export interface EventFilter {
  staffId?: number;
  domain?: string;
  browser?: string;
  deviceId?: string;
  dateFrom?: string;
  dateTo?: string;
  categoryId?: number;
  riskLevel?: string;
  securityOnly?: boolean;
  page?: number;
  pageSize?: number;
}

const EVENT_SORT_COLUMN = "e.VisitedAt";

export async function listEvents(filter: EventFilter): Promise<{ events: BrowserActivityEvent[]; total: number }> {
  const db = await getDb();
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const req = db
    .request()
    .input("staffId", sql.Int, filter.staffId ?? null)
    .input("domain", sql.NVarChar, filter.domain ? `%${filter.domain}%` : null)
    .input("browser", sql.VarChar, filter.browser ?? null)
    .input("deviceId", sql.VarChar, filter.deviceId ?? null)
    .input("dateFrom", sql.DateTime2, filter.dateFrom ? new Date(filter.dateFrom) : null)
    .input("dateTo", sql.DateTime2, filter.dateTo ? new Date(filter.dateTo) : null)
    .input("categoryId", sql.Int, filter.categoryId ?? null)
    .input("riskLevel", sql.VarChar, filter.riskLevel ?? null)
    .input("securityOnly", sql.Bit, filter.securityOnly ? 1 : 0)
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize);

  const where = `
    WHERE (@staffId IS NULL OR e.StaffId = @staffId)
      AND (@domain IS NULL OR e.Domain LIKE @domain)
      AND (@browser IS NULL OR e.Browser = @browser)
      AND (@deviceId IS NULL OR e.DeviceId = @deviceId)
      AND (@dateFrom IS NULL OR e.VisitedAt >= @dateFrom)
      AND (@dateTo IS NULL OR e.VisitedAt <= @dateTo)
      AND (@categoryId IS NULL OR e.CategoryId = @categoryId)
      AND (@riskLevel IS NULL OR e.RiskLevel = @riskLevel)
      AND (@securityOnly = 0 OR e.IsSecurityEvent = 1)
  `;

  const [rows, count] = await Promise.all([
    req.query(`
      SELECT e.*, c.Name AS CategoryName FROM BrowserActivityEvents e LEFT JOIN DomainCategories c ON c.Id = e.CategoryId
      ${where} ORDER BY ${EVENT_SORT_COLUMN} DESC OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
    `),
    req.query(`SELECT COUNT(*) AS Total FROM BrowserActivityEvents e ${where}`),
  ]);

  return { events: rows.recordset.map(mapEvent), total: count.recordset[0].Total as number };
}

// --- Dashboard aggregation ----------------------------------------------------------------

export async function getDashboardStats(dateFrom: Date, dateTo: Date) {
  const db = await getDb();
  const req = db.request().input("dateFrom", sql.DateTime2, dateFrom).input("dateTo", sql.DateTime2, dateTo);

  const [topDomains, byCategory, byDevice, dailyTrend, securityAlerts] = await Promise.all([
    req.query(`
      SELECT TOP 15 e.Domain, c.Name AS CategoryName, c.RiskLevel, COUNT(*) AS VisitCount, SUM(ISNULL(e.DwellSeconds, 0)) AS TotalDwellSeconds
      FROM BrowserActivityEvents e LEFT JOIN DomainCategories c ON c.Id = e.CategoryId
      WHERE e.VisitedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY e.Domain, c.Name, c.RiskLevel ORDER BY VisitCount DESC
    `),
    req.query(`
      SELECT ISNULL(c.Name, 'Uncategorized') AS CategoryName, COUNT(*) AS VisitCount
      FROM BrowserActivityEvents e LEFT JOIN DomainCategories c ON c.Id = e.CategoryId
      WHERE e.VisitedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY c.Name ORDER BY VisitCount DESC
    `),
    req.query(`
      SELECT e.DeviceId, d.Hostname, COUNT(*) AS VisitCount
      FROM BrowserActivityEvents e JOIN Devices d ON d.DeviceId = e.DeviceId
      WHERE e.VisitedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY e.DeviceId, d.Hostname ORDER BY VisitCount DESC
    `),
    req.query(`
      SELECT CAST(e.VisitedAt AS DATE) AS Day, COUNT(*) AS VisitCount
      FROM BrowserActivityEvents e WHERE e.VisitedAt BETWEEN @dateFrom AND @dateTo
      GROUP BY CAST(e.VisitedAt AS DATE) ORDER BY Day ASC
    `),
    req.query(`
      SELECT COUNT(*) AS SecurityEventCount FROM BrowserActivityEvents e
      WHERE e.VisitedAt BETWEEN @dateFrom AND @dateTo AND e.IsSecurityEvent = 1
    `),
  ]);

  return {
    topDomains: topDomains.recordset,
    byCategory: byCategory.recordset,
    byDevice: byDevice.recordset,
    dailyTrend: dailyTrend.recordset,
    securityEventCount: securityAlerts.recordset[0]?.SecurityEventCount ?? 0,
  };
}

// --- Retention ------------------------------------------------------------------------------

export async function deleteEventsOlderThan(retentionDays: number, batchSize: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .request()
    .input("days", sql.Int, retentionDays)
    .input("batchSize", sql.Int, batchSize)
    .query(`DELETE TOP (@batchSize) FROM BrowserActivityEvents WHERE ReceivedAt < DATEADD(DAY, -@days, SYSUTCDATETIME())`);
  return result.rowsAffected[0] ?? 0;
}

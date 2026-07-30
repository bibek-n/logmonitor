import { getDb, sql } from "../db";
import { DEFAULT_ARCHIVE_LIMITS, MailAction, MailDirection, MailPolicy, MailPolicyException, PolicyRules, ScopeType, UrlRules } from "./types";

interface PolicyRow {
  Id: number;
  Name: string;
  Description: string | null;
  Enabled: boolean;
  Mandatory: boolean;
  Direction: MailDirection;
  Priority: number;
  Action: MailAction;
  RulesJson: string;
  UrlPatternsJson: string | null;
  NotifySender: boolean;
  NotifyRecipient: boolean;
  NotifyAdminEmail: string | null;
}

interface ScopeRow {
  Id: number;
  PolicyId: number;
  ScopeType: ScopeType;
  ScopeValue: string | null;
}

function parseRules(raw: string): PolicyRules {
  try {
    const parsed = JSON.parse(raw);
    return {
      extensions: Array.isArray(parsed.extensions) ? parsed.extensions : [],
      mimeTypes: Array.isArray(parsed.mimeTypes) ? parsed.mimeTypes : [],
      characteristics: parsed.characteristics ?? {},
      archiveLimits: { ...DEFAULT_ARCHIVE_LIMITS, ...(parsed.archiveLimits ?? {}) },
    };
  } catch {
    return { extensions: [], mimeTypes: [], characteristics: {}, archiveLimits: DEFAULT_ARCHIVE_LIMITS };
  }
}

function parseUrlRules(raw: string | null): UrlRules | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      blockAllCloudLinks: !!parsed.blockAllCloudLinks,
      blockedProviders: Array.isArray(parsed.blockedProviders) ? parsed.blockedProviders : [],
      blockPublicSharing: !!parsed.blockPublicSharing,
      blockDownloadable: !!parsed.blockDownloadable,
      urlPatterns: Array.isArray(parsed.urlPatterns) ? parsed.urlPatterns : [],
      allowlist: Array.isArray(parsed.allowlist) ? parsed.allowlist : [],
    };
  } catch {
    return null;
  }
}

function rowToPolicy(row: PolicyRow, scopes: ScopeRow[]): MailPolicy {
  return {
    id: row.Id,
    name: row.Name,
    description: row.Description,
    enabled: row.Enabled,
    mandatory: row.Mandatory,
    direction: row.Direction,
    priority: row.Priority,
    action: row.Action,
    rules: parseRules(row.RulesJson),
    urlRules: parseUrlRules(row.UrlPatternsJson),
    notifySender: row.NotifySender,
    notifyRecipient: row.NotifyRecipient,
    notifyAdminEmail: row.NotifyAdminEmail,
    scopes: scopes.filter((s) => s.PolicyId === row.Id).map((s) => ({ id: s.Id, scopeType: s.ScopeType, scopeValue: s.ScopeValue })),
  };
}

// Loads every enabled, non-deleted policy plus its scopes, ready to hand to
// policyEngine.evaluateMessage(). Shared by every route that needs to run the engine
// (policy /test, and Stage 2's future live-message path) so the DB->engine-type mapping
// lives in exactly one place.
export async function loadActivePolicies(): Promise<MailPolicy[]> {
  const db = await getDb();
  const policiesResult = await db.query<PolicyRow>(
    "SELECT Id, Name, Description, Enabled, Mandatory, Direction, Priority, Action, RulesJson, UrlPatternsJson, NotifySender, NotifyRecipient, NotifyAdminEmail FROM MailBlockingPolicies WHERE DeletedAt IS NULL AND Enabled = 1"
  );
  if (policiesResult.recordset.length === 0) return [];

  const scopesResult = await db.query<ScopeRow>(
    "SELECT Id, PolicyId, ScopeType, ScopeValue FROM MailPolicyScopes WHERE PolicyId IN (SELECT Id FROM MailBlockingPolicies WHERE DeletedAt IS NULL AND Enabled = 1)"
  );

  return policiesResult.recordset.map((row) => rowToPolicy(row, scopesResult.recordset));
}

export async function loadPolicyById(id: number): Promise<MailPolicy | null> {
  const db = await getDb();
  const policyResult = await db
    .request()
    .input("id", sql.Int, id)
    .query<PolicyRow>(
      "SELECT Id, Name, Description, Enabled, Mandatory, Direction, Priority, Action, RulesJson, UrlPatternsJson, NotifySender, NotifyRecipient, NotifyAdminEmail FROM MailBlockingPolicies WHERE Id = @id AND DeletedAt IS NULL"
    );
  const row = policyResult.recordset[0];
  if (!row) return null;

  const scopesResult = await db
    .request()
    .input("id", sql.Int, id)
    .query<ScopeRow>("SELECT Id, PolicyId, ScopeType, ScopeValue FROM MailPolicyScopes WHERE PolicyId = @id");

  return rowToPolicy(row, scopesResult.recordset);
}

export async function loadActiveExceptions(): Promise<MailPolicyException[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    PolicyId: number | null;
    ExceptionType: MailPolicyException["exceptionType"];
    ExceptionValue: string;
    Reason: string;
    ApprovedByUserId: number;
    ExpiresAt: string | null;
    RevokedAt: string | null;
  }>(
    "SELECT Id, PolicyId, ExceptionType, ExceptionValue, Reason, ApprovedByUserId, CONVERT(VARCHAR(33), ExpiresAt, 126) AS ExpiresAt, CONVERT(VARCHAR(33), RevokedAt, 126) AS RevokedAt FROM MailPolicyExceptions WHERE RevokedAt IS NULL"
  );

  return result.recordset.map((r) => ({
    id: r.Id,
    policyId: r.PolicyId,
    exceptionType: r.ExceptionType,
    exceptionValue: r.ExceptionValue.toLowerCase(),
    reason: r.Reason,
    approvedByUserId: r.ApprovedByUserId,
    expiresAt: r.ExpiresAt,
    revokedAt: r.RevokedAt,
  }));
}

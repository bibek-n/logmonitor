import { getDb, sql } from "../db";
import { decryptOffboardingSecret, encryptOffboardingSecret } from "./crypto";

export interface OffboardingSettings {
  gitlabBaseUrl: string | null;
  gitlabTokenConfigured: boolean;
  glesysApiUser: string | null;
  glesysApiKeyConfigured: boolean;
  agentQaApiUrl: string | null;
  agentQaApiKeyConfigured: boolean;
  teamworkApiUrl: string | null;
  teamworkApiKeyConfigured: boolean;
  adBindDn: string | null;
  adBindPasswordConfigured: boolean;
  updatedAt: Date | null;
}

interface SettingsRow {
  GitLabBaseUrl: string | null;
  GitLabEncryptedToken: string | null;
  GlesysApiUser: string | null;
  GlesysEncryptedApiKey: string | null;
  AgentQaApiUrl: string | null;
  AgentQaEncryptedApiKey: string | null;
  TeamworkApiUrl: string | null;
  TeamworkEncryptedApiKey: string | null;
  AdBindDn: string | null;
  AdEncryptedBindPassword: string | null;
  UpdatedAt: Date | null;
}

const SETTINGS_COLUMNS =
  "GitLabBaseUrl, GitLabEncryptedToken, GlesysApiUser, GlesysEncryptedApiKey, AgentQaApiUrl, AgentQaEncryptedApiKey, TeamworkApiUrl, TeamworkEncryptedApiKey, AdBindDn, AdEncryptedBindPassword, UpdatedAt";

// Mirrors the Remote Access Credentials Vault's "never send a stored secret back out" convention
// - the settings UI only ever learns whether a credential is configured, never its value.
export async function getOffboardingSettings(): Promise<OffboardingSettings> {
  const db = await getDb();
  const result = await db.query<SettingsRow>(`SELECT ${SETTINGS_COLUMNS} FROM OffboardingSettings WHERE Id = 1`);
  const row = result.recordset[0];
  return {
    gitlabBaseUrl: row?.GitLabBaseUrl ?? null,
    gitlabTokenConfigured: !!row?.GitLabEncryptedToken,
    glesysApiUser: row?.GlesysApiUser ?? null,
    glesysApiKeyConfigured: !!row?.GlesysEncryptedApiKey,
    agentQaApiUrl: row?.AgentQaApiUrl ?? null,
    agentQaApiKeyConfigured: !!row?.AgentQaEncryptedApiKey,
    teamworkApiUrl: row?.TeamworkApiUrl ?? null,
    teamworkApiKeyConfigured: !!row?.TeamworkEncryptedApiKey,
    adBindDn: row?.AdBindDn ?? null,
    adBindPasswordConfigured: !!row?.AdEncryptedBindPassword,
    updatedAt: row?.UpdatedAt ?? null,
  };
}

// Internal-only (never exposed over the API) - used by offboardingService to actually make the
// GitLab/Glesys/AgentQA/Teamwork calls.
export async function getDecryptedOffboardingCredentials(): Promise<{
  gitlabBaseUrl: string | null;
  gitlabToken: string | null;
  glesysApiUser: string | null;
  glesysApiKey: string | null;
  agentQaApiUrl: string | null;
  agentQaApiKey: string | null;
  teamworkApiUrl: string | null;
  teamworkApiKey: string | null;
  adBindDn: string | null;
  adBindPassword: string | null;
}> {
  const db = await getDb();
  const result = await db.query<SettingsRow>(`SELECT ${SETTINGS_COLUMNS} FROM OffboardingSettings WHERE Id = 1`);
  const row = result.recordset[0];
  return {
    gitlabBaseUrl: row?.GitLabBaseUrl ?? null,
    gitlabToken: row?.GitLabEncryptedToken ? decryptOffboardingSecret(row.GitLabEncryptedToken) : null,
    glesysApiUser: row?.GlesysApiUser ?? null,
    glesysApiKey: row?.GlesysEncryptedApiKey ? decryptOffboardingSecret(row.GlesysEncryptedApiKey) : null,
    agentQaApiUrl: row?.AgentQaApiUrl ?? null,
    agentQaApiKey: row?.AgentQaEncryptedApiKey ? decryptOffboardingSecret(row.AgentQaEncryptedApiKey) : null,
    teamworkApiUrl: row?.TeamworkApiUrl ?? null,
    teamworkApiKey: row?.TeamworkEncryptedApiKey ? decryptOffboardingSecret(row.TeamworkEncryptedApiKey) : null,
    adBindDn: row?.AdBindDn ?? null,
    adBindPassword: row?.AdEncryptedBindPassword ? decryptOffboardingSecret(row.AdEncryptedBindPassword) : null,
  };
}

export async function updateOffboardingSettings(
  input: {
    gitlabBaseUrl?: string;
    gitlabToken?: string;
    glesysApiUser?: string;
    glesysApiKey?: string;
    agentQaApiUrl?: string;
    agentQaApiKey?: string;
    teamworkApiUrl?: string;
    teamworkApiKey?: string;
    adBindDn?: string;
    adBindPassword?: string;
  },
  userId: number
): Promise<void> {
  const db = await getDb();
  const request = db.request().input("userId", sql.Int, userId);

  const sets: string[] = ["UpdatedAt = SYSUTCDATETIME()", "UpdatedByUserId = @userId"];
  if (input.gitlabBaseUrl !== undefined) {
    request.input("gitlabBaseUrl", sql.NVarChar, input.gitlabBaseUrl || null);
    sets.push("GitLabBaseUrl = @gitlabBaseUrl");
  }
  if (input.gitlabToken) {
    request.input("gitlabToken", sql.NVarChar(sql.MAX), encryptOffboardingSecret(input.gitlabToken));
    sets.push("GitLabEncryptedToken = @gitlabToken");
  }
  if (input.glesysApiUser !== undefined) {
    request.input("glesysApiUser", sql.NVarChar, input.glesysApiUser || null);
    sets.push("GlesysApiUser = @glesysApiUser");
  }
  if (input.glesysApiKey) {
    request.input("glesysApiKey", sql.NVarChar(sql.MAX), encryptOffboardingSecret(input.glesysApiKey));
    sets.push("GlesysEncryptedApiKey = @glesysApiKey");
  }
  if (input.agentQaApiUrl !== undefined) {
    request.input("agentQaApiUrl", sql.NVarChar, input.agentQaApiUrl || null);
    sets.push("AgentQaApiUrl = @agentQaApiUrl");
  }
  if (input.agentQaApiKey) {
    request.input("agentQaApiKey", sql.NVarChar(sql.MAX), encryptOffboardingSecret(input.agentQaApiKey));
    sets.push("AgentQaEncryptedApiKey = @agentQaApiKey");
  }
  if (input.teamworkApiUrl !== undefined) {
    request.input("teamworkApiUrl", sql.NVarChar, input.teamworkApiUrl || null);
    sets.push("TeamworkApiUrl = @teamworkApiUrl");
  }
  if (input.teamworkApiKey) {
    request.input("teamworkApiKey", sql.NVarChar(sql.MAX), encryptOffboardingSecret(input.teamworkApiKey));
    sets.push("TeamworkEncryptedApiKey = @teamworkApiKey");
  }
  if (input.adBindDn !== undefined) {
    request.input("adBindDn", sql.NVarChar, input.adBindDn || null);
    sets.push("AdBindDn = @adBindDn");
  }
  if (input.adBindPassword) {
    request.input("adBindPassword", sql.NVarChar(sql.MAX), encryptOffboardingSecret(input.adBindPassword));
    sets.push("AdEncryptedBindPassword = @adBindPassword");
  }

  await request.query(`UPDATE OffboardingSettings SET ${sets.join(", ")} WHERE Id = 1`);
}

import { logAdminAction } from "../adminAudit";
import { getDb, sql } from "../db";
import { EXCLUDED_ACCOUNTS } from "../activeDirectorySync";
import { encryptOffboardingSecret } from "./crypto";
import * as gitlab from "./gitlabClient";
import * as glesys from "./glesysClient";
import * as agentQa from "./agentQaClient";
import * as teamwork from "./teamworkClient";
import * as activeDirectory from "./activeDirectoryClient";
import { getOffboardingEmployee, getOrCreateOpenAction, updateActionSystemResult, finalizeActionOverallStatus, type OffboardingActionRow } from "./repository";
import { getDecryptedOffboardingCredentials } from "./settingsRepository";

// The orchestrator behind "Disable All". Each system (GitLab, Glesys) is attempted
// independently and never lets the other's failure block it - a GitLab outage shouldn't prevent
// locking the mailbox, and vice versa. Re-running (the same "Disable All" click again, or an
// explicit retry) re-uses the same OffboardingActions row and only re-attempts whichever
// system(s) didn't already reach a terminal success state - see repository.ts's
// getOrCreateOpenAction - so repeated clicks never re-block an already-blocked GitLab user or
// generate a second throwaway mailbox password for no reason.

async function runGitLabStep(action: OffboardingActionRow, gitlabUserId: number | null, gitlabUsername: string | null): Promise<string> {
  if (action.gitlabStatus === "Success") return action.gitlabStatus;

  if (!gitlabUserId) {
    const detail = gitlabUsername
      ? `GitLab username "${gitlabUsername}" is mapped but has no resolved user ID - re-save the mapping via a GitLab user search first.`
      : "No GitLab account mapped to this employee.";
    await updateActionSystemResult(action.id, "gitlab", "Skipped", detail);
    return "Skipped";
  }

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.gitlabBaseUrl || !creds.gitlabToken) {
    await updateActionSystemResult(action.id, "gitlab", "Failed", "GitLab is not configured (missing base URL or admin token) - set it up under Offboarding Settings.");
    return "Failed";
  }

  try {
    const { alreadyBlocked } = await gitlab.blockUser(creds.gitlabBaseUrl, creds.gitlabToken, gitlabUserId);

    let revokedTokenCount = 0;
    let tokenRevokeErrors = 0;
    try {
      const tokens = await gitlab.listPersonalAccessTokens(creds.gitlabBaseUrl, creds.gitlabToken, gitlabUserId);
      for (const t of tokens) {
        try {
          await gitlab.revokePersonalAccessToken(creds.gitlabBaseUrl, creds.gitlabToken, t.id);
          revokedTokenCount++;
        } catch {
          tokenRevokeErrors++;
        }
      }
    } catch {
      // Listing PATs needs admin scope too; if it's unavailable on this GitLab version/token,
      // the block itself (which already prevents all further authentication) still stands.
    }

    const verified = await gitlab.getUser(creds.gitlabBaseUrl, creds.gitlabToken, gitlabUserId);
    if (verified.state !== "blocked" && !verified.state.includes("blocked")) {
      await updateActionSystemResult(action.id, "gitlab", "Failed", `Block call succeeded but verification shows state="${verified.state}", not blocked.`);
      return "Failed";
    }

    const detail = `${alreadyBlocked ? "Already blocked" : "Blocked"} user #${gitlabUserId} (${verified.username}); verified state=${verified.state}. Revoked ${revokedTokenCount} personal access token(s)${tokenRevokeErrors ? ` (${tokenRevokeErrors} could not be revoked)` : ""}.`;
    await updateActionSystemResult(action.id, "gitlab", "Success", detail);
    return "Success";
  } catch (err) {
    await updateActionSystemResult(action.id, "gitlab", "Failed", err instanceof Error ? err.message : String(err));
    return "Failed";
  }
}

async function runGlesysStep(action: OffboardingActionRow, glesysMailbox: string | null): Promise<string> {
  if (action.glesysStatus === "Success" || action.glesysStatus === "ManualActionRequired") return action.glesysStatus;

  if (!glesysMailbox) {
    await updateActionSystemResult(action.id, "glesys", "Skipped", "No Glesys mailbox mapped to this employee.");
    return "Skipped";
  }

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.glesysApiUser || !creds.glesysApiKey) {
    await updateActionSystemResult(action.id, "glesys", "Failed", "Glesys is not configured (missing API user or API key) - set it up under Offboarding Settings.");
    return "Failed";
  }

  try {
    const account = await glesys.findEmailAccount(creds.glesysApiUser, creds.glesysApiKey, glesysMailbox);
    if (!account) {
      await updateActionSystemResult(action.id, "glesys", "Failed", `Mailbox "${glesysMailbox}" was not found on Glesys - check the mapping.`);
      return "Failed";
    }

    const newPassword = glesys.generateRandomPassword();
    await glesys.resetMailboxPassword(creds.glesysApiUser, creds.glesysApiKey, glesysMailbox, newPassword);

    const detail =
      "Glesys's documented email API has no dedicated mailbox-disable action, so this reset the mailbox's password to a new value the employee was never given - IMAP/POP/webmail login now requires a password only an admin can retrieve. " +
      "The mailbox and all its mail are untouched. Manual follow-up still needed: hand the new password to the employee's manager (use the reveal action on this record) if they need access, and check for any forwarding rules, aliases, or app-specific passwords this reset doesn't cover.";
    await updateActionSystemResult(action.id, "glesys", "ManualActionRequired", detail, { glesysNewPasswordEncrypted: encryptOffboardingSecret(newPassword) });
    return "ManualActionRequired";
  } catch (err) {
    await updateActionSystemResult(action.id, "glesys", "Failed", err instanceof Error ? err.message : String(err));
    return "Failed";
  }
}

async function runAgentQaStep(action: OffboardingActionRow, email: string | null, agentQaUserId: string | null): Promise<string> {
  if (action.agentQaStatus === "Success") return action.agentQaStatus;

  // Unlike GitLab/Glesys, AgentQA needs no mandatory mapping step - its own API matches by
  // login email, so Staff.Email (already on every employee) is the default identifier.
  // agentQaUserId is only an override for the rare case where the AgentQA login differs.
  if (!agentQaUserId && !email) {
    await updateActionSystemResult(action.id, "agentqa", "Skipped", "This employee has no email address and no AgentQA user id override - nothing to identify their AgentQA account with.");
    return "Skipped";
  }

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.agentQaApiUrl || !creds.agentQaApiKey) {
    await updateActionSystemResult(action.id, "agentqa", "Failed", "AgentQA is not configured (missing API URL or API key) - set it up under Offboarding Settings.");
    return "Failed";
  }

  // The override field is labeled "AgentQA user id" but nothing stops someone from typing an
  // email into it instead (confirmed live: a mapping had an email in this field, which AgentQA's
  // API correctly rejected with "Invalid uuid" since it only accepts a real UUID there) - detect
  // that and send it as `email` instead of `user_id` rather than failing on an honest mistake.
  const identifier = agentQaUserId ? (agentQaUserId.includes("@") ? { email: agentQaUserId } : { userId: agentQaUserId }) : { email: email! };

  try {
    const result = await agentQa.setUserAccess(creds.agentQaApiUrl, creds.agentQaApiKey, identifier, true);
    await updateActionSystemResult(action.id, "agentqa", "Success", `Disabled sign-in for ${result.email} (AgentQA user #${result.user_id}). Already-signed-in sessions stay valid for up to ~1 hour per AgentQA's own documented behavior.`);
    return "Success";
  } catch (err) {
    if (err instanceof agentQa.AgentQaApiError && err.status === 403) {
      // AgentQA's own protected "super user" account - not a failure of this integration,
      // the API is correctly refusing to touch it.
      await updateActionSystemResult(action.id, "agentqa", "Skipped", "AgentQA refused: this is the protected super user account and can never be disabled through this API.");
      return "Skipped";
    }
    if (err instanceof agentQa.AgentQaApiError && err.status === 404) {
      await updateActionSystemResult(action.id, "agentqa", "Failed", `No AgentQA account found for "${identifier.email ?? identifier.userId}" - check the mapping or the employee's Staff email.`);
      return "Failed";
    }
    await updateActionSystemResult(action.id, "agentqa", "Failed", err instanceof Error ? err.message : String(err));
    return "Failed";
  }
}

async function runTeamworkStep(action: OffboardingActionRow, email: string | null, teamworkEmail: string | null): Promise<string> {
  if (action.teamworkStatus === "Success") return action.teamworkStatus;

  const effectiveEmail = teamworkEmail || email;
  if (!effectiveEmail) {
    await updateActionSystemResult(action.id, "teamwork", "Skipped", "This employee has no email address and no Teamwork email override - nothing to identify their Teamwork account with.");
    return "Skipped";
  }

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.teamworkApiUrl || !creds.teamworkApiKey) {
    await updateActionSystemResult(action.id, "teamwork", "Failed", "Teamwork is not configured (missing API URL or API key) - set it up under Offboarding Settings.");
    return "Failed";
  }

  try {
    // action.teamworkRequestId is generated once (SQL DEFAULT NEWID()) when this offboarding
    // attempt's row is first created and never changes - confirmed live this must stay stable
    // across retries, not a fresh UUID per call (see teamworkClient.ts).
    await teamwork.revokeUserAccess(creds.teamworkApiUrl, creds.teamworkApiKey, effectiveEmail, action.teamworkRequestId, `Employee offboarding via LogMonitor (${action.staffId})`);
    await updateActionSystemResult(
      action.id,
      "teamwork",
      "Success",
      `Disabled sign-in for ${effectiveEmail} on Teamwork. This is reversible in principle, but no restore/re-enable endpoint was documented for this API - re-enabling currently needs a manual step on Teamwork's side.`
    );
    return "Success";
  } catch (err) {
    await updateActionSystemResult(action.id, "teamwork", "Failed", err instanceof Error ? err.message : String(err));
    return "Failed";
  }
}

async function runLogMonitorStep(action: OffboardingActionRow, adminUserId: number, email: string | null, logMonitorUsername: string | null): Promise<string> {
  if (action.logMonitorStatus === "Success") return action.logMonitorStatus;

  // Unlike the other four, this is entirely internal - no external API/credentials, just this
  // app's own Users table. Matches by email like AgentQA/Teamwork by default; logMonitorUsername
  // is only an override for the rare case where a Staff record's email differs from their login.
  const db = await getDb();
  let userRow: { Id: number; Username: string; Role: string; IsActive: boolean } | undefined;
  if (logMonitorUsername?.includes("@")) {
    // The override field is labeled "LogMonitor username" but nothing stops someone from typing
    // an email into it instead (confirmed live: a mapping had "anish@tulipstechnologies.com" in
    // this field while the real Username was "anish") - detect that and match on Email instead
    // of failing the lookup, same fix already applied to the AgentQA override.
    const r = await db.request().input("email", sql.NVarChar, logMonitorUsername).query<{ Id: number; Username: string; Role: string; IsActive: boolean }>(
      "SELECT Id, Username, Role, IsActive FROM Users WHERE Email = @email"
    );
    userRow = r.recordset[0];
  } else if (logMonitorUsername) {
    const r = await db.request().input("username", sql.NVarChar, logMonitorUsername).query<{ Id: number; Username: string; Role: string; IsActive: boolean }>(
      "SELECT Id, Username, Role, IsActive FROM Users WHERE Username = @username"
    );
    userRow = r.recordset[0];
  } else if (email) {
    const r = await db.request().input("email", sql.NVarChar, email).query<{ Id: number; Username: string; Role: string; IsActive: boolean }>(
      "SELECT Id, Username, Role, IsActive FROM Users WHERE Email = @email"
    );
    userRow = r.recordset[0];
  }

  if (!userRow) {
    await updateActionSystemResult(
      action.id,
      "logmonitor",
      "Skipped",
      "No matching LogMonitor login found for this employee (checked by email, or the LogMonitor username override if set). They may simply not have their own LogMonitor account."
    );
    return "Skipped";
  }

  // Safety rail: never let "Disable All" deactivate the admin account that's doing the clicking.
  if (userRow.Id === adminUserId) {
    await updateActionSystemResult(action.id, "logmonitor", "Skipped", "The matched LogMonitor account is your own signed-in account - refusing to disable it through this feature as a safety measure.");
    return "Skipped";
  }

  if (!userRow.IsActive) {
    await updateActionSystemResult(action.id, "logmonitor", "Success", `LogMonitor login "${userRow.Username}" is already deactivated.`);
    return "Success";
  }

  // Second safety rail: never let this leave the system with zero active Admins.
  if (userRow.Role === "Admin") {
    const remaining = await db.request().input("excludeId", sql.Int, userRow.Id).query<{ Cnt: number }>(
      "SELECT COUNT(*) AS Cnt FROM Users WHERE Role = 'Admin' AND IsActive = 1 AND Id <> @excludeId"
    );
    if ((remaining.recordset[0]?.Cnt ?? 0) === 0) {
      await updateActionSystemResult(
        action.id,
        "logmonitor",
        "Failed",
        `"${userRow.Username}" is the last active Admin account - deactivating it would lock everyone out of Admin access. Promote another Admin first, then retry.`
      );
      return "Failed";
    }
  }

  await db.request().input("id", sql.Int, userRow.Id).query("UPDATE Users SET IsActive = 0 WHERE Id = @id");
  await updateActionSystemResult(
    action.id,
    "logmonitor",
    "Success",
    `Deactivated LogMonitor login "${userRow.Username}" (blocks sign-in immediately). An already-open browser session stays valid until it naturally expires - same caveat as the other systems. Reversible any time from Users and Access.`
  );
  return "Success";
}

async function runActiveDirectoryStep(action: OffboardingActionRow, adUsername: string | null): Promise<string> {
  if (action.activeDirectoryStatus === "Success") return action.activeDirectoryStatus;

  // Unlike GitLab/AgentQA/Teamwork, this has NO auto-match-by-email fallback: AD's "mail"
  // attribute is empty for every real user here and the UPN domain (tulipstech.com) doesn't
  // match the office email domain (tulipstechnologies.com) - see activeDirectorySync.ts's own
  // comment on this exact mismatch. Guessing wrong here means disabling the wrong person's
  // domain/VPN login, so an explicit sAMAccountName mapping is required.
  if (!adUsername) {
    await updateActionSystemResult(action.id, "activedirectory", "Skipped", "No Active Directory username mapped to this employee - set it under Map accounts.");
    return "Skipped";
  }

  if (EXCLUDED_ACCOUNTS.has(adUsername.toLowerCase())) {
    await updateActionSystemResult(action.id, "activedirectory", "Skipped", `"${adUsername}" is a built-in/service account, not a real employee login - refusing to touch it as a safety measure.`);
    return "Skipped";
  }

  const creds = await getDecryptedOffboardingCredentials();
  if (!creds.adBindDn || !creds.adBindPassword) {
    await updateActionSystemResult(action.id, "activedirectory", "Failed", "Active Directory is not configured (missing the bind account's DN or password) - set it up under Offboarding Settings.");
    return "Failed";
  }

  const server = process.env.AD_SERVER;
  const baseDn = process.env.AD_BASE_DN;
  if (!server || !baseDn) {
    await updateActionSystemResult(action.id, "activedirectory", "Failed", "AD_SERVER/AD_BASE_DN are not configured on the server (same env vars the AD Sync feature uses).");
    return "Failed";
  }

  try {
    const result = await activeDirectory.disableAdAccount(server, baseDn, creds.adBindDn, creds.adBindPassword, adUsername);
    const detail = result.alreadyDisabled
      ? `"${adUsername}" (${result.distinguishedName}) was already disabled in Active Directory.`
      : `Disabled Active Directory account "${adUsername}" (${result.distinguishedName}) - blocks domain/VPN login immediately. An already-open Windows session isn't forcibly logged off. Reversible any time by an AD administrator.`;
    await updateActionSystemResult(action.id, "activedirectory", "Success", detail);
    return "Success";
  } catch (err) {
    await updateActionSystemResult(action.id, "activedirectory", "Failed", err instanceof Error ? err.message : String(err));
    return "Failed";
  }
}

export async function runDisableAll(staffId: number, adminUserId: number, adminUsername: string): Promise<OffboardingActionRow> {
  const employee = await getOffboardingEmployee(staffId);
  if (!employee) throw new Error("Employee not found");

  const action = await getOrCreateOpenAction(staffId, adminUserId, adminUsername);

  const [gitlabResult, glesysResult, agentQaResult, teamworkResult, logMonitorResult, activeDirectoryResult] = await Promise.all([
    runGitLabStep(action, employee.gitlabUserId, employee.gitlabUsername),
    runGlesysStep(action, employee.glesysMailbox),
    runAgentQaStep(action, employee.email, employee.agentQaUserId),
    runTeamworkStep(action, employee.email, employee.teamworkEmail),
    runLogMonitorStep(action, adminUserId, employee.email, employee.logMonitorUsername),
    runActiveDirectoryStep(action, employee.adUsername),
  ]);

  const finalAction = await finalizeActionOverallStatus(action.id);

  // The hash-chained AdminAuditLog (every admin action in this app goes through it) records who
  // did this, when, and the outcome. OffboardingActions itself (per-system status/detail/
  // timestamps, already persisted above) is the structured record of exactly what happened to
  // each system - no second audit mechanism needed on top of those two.
  await logAdminAction({
    admin: { userId: adminUserId, username: adminUsername },
    section: "offboarding",
    action: "disable_all",
    details: `${employee.name} (#${staffId}): GitLab=${gitlabResult}, Glesys=${glesysResult}, AgentQA=${agentQaResult}, Teamwork=${teamworkResult}, LogMonitor=${logMonitorResult}, ActiveDirectory=${activeDirectoryResult}, Overall=${finalAction.overallStatus}`,
  });

  return finalAction;
}

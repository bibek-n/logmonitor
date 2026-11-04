import ldap from "ldapjs";
import { getDb, sql } from "@/lib/db";
import type { ExportColumn } from "@/lib/itAssetLogsheet/exportHelpers";

// Built-in/system AD accounts that are never real employees - excluded by sAMAccountName
// rather than by OU, since (confirmed against the real directory this was built against)
// ordinary employee accounts live in the same default CN=Users container as these, so OU
// alone can't distinguish them.
// svc-logmonitor is this sync's own bind account (see docs), not a real employee - excluded
// by name rather than by naming convention (e.g. a "svc-" prefix filter) since that's more
// fragile if this account is ever renamed.
// Exported so other AD-touching code (e.g. offboarding's disable step) shares one list rather
// than risking drift between two separately-maintained exclusion sets.
export const EXCLUDED_ACCOUNTS = new Set(
  ["administrator", "guest", "krbtgt", "defaultaccount", "wdagutilityaccount", "svc-logmonitor", "svc-offboard"].map((n) => n.toLowerCase())
);

// userAccountControl bit 2 (0x2) = ACCOUNTDISABLE - standard AD flag, unrelated to whether
// the account exists at all.
const UAC_ACCOUNTDISABLE = 0x2;

interface AdUserEntry {
  objectGuid: string;
  sAMAccountName: string;
  name: string;
  email: string | null;
  department: string | null;
  title: string | null;
  telephoneNumber: string | null;
  disabled: boolean;
}

function bufferToGuidString(buf: Buffer): string {
  // AD's objectGUID comes back as a raw 16-byte binary blob in mixed-endian order (the first
  // three fields are little-endian, the last two are big-endian) - this is the standard
  // byte-swap needed to render it as the same GUID string format shown in AD tools.
  const hex = (start: number, end: number) => buf.subarray(start, end).toString("hex");
  const p1 = Buffer.from(buf.subarray(0, 4)).reverse().toString("hex");
  const p2 = Buffer.from(buf.subarray(4, 6)).reverse().toString("hex");
  const p3 = Buffer.from(buf.subarray(6, 8)).reverse().toString("hex");
  const p4 = hex(8, 10);
  const p5 = hex(10, 16);
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
}

function firstAttrValue(entry: ldap.SearchEntry, name: string): string | null {
  const attr = entry.attributes.find((a) => a.type.toLowerCase() === name.toLowerCase());
  if (!attr || attr.values.length === 0) return null;
  const v = attr.values[0];
  return typeof v === "string" && v ? v : null;
}

function objectGuidAttrValue(entry: ldap.SearchEntry): string | null {
  const attr = entry.attributes.find((a) => a.type.toLowerCase() === "objectguid");
  if (!attr || attr.buffers.length === 0) return null;
  return bufferToGuidString(attr.buffers[0]);
}

// Fetches every enabled-or-not, real (non-system) user account from AD. Reads
// AD_SERVER/AD_BIND_DN/AD_BIND_PASSWORD/AD_BASE_DN from env - same "never a real credential
// in a committed file" convention as every other integration credential in this codebase
// (see src/lib/db.ts's own DB_* env vars).
export function fetchAdUsers(): Promise<AdUserEntry[]> {
  return new Promise((resolve, reject) => {
    const server = process.env.AD_SERVER;
    const bindDn = process.env.AD_BIND_DN;
    const bindPassword = process.env.AD_BIND_PASSWORD;
    const baseDn = process.env.AD_BASE_DN;
    if (!server || !bindDn || !bindPassword || !baseDn) {
      reject(new Error("AD_SERVER, AD_BIND_DN, AD_BIND_PASSWORD, and AD_BASE_DN must all be set"));
      return;
    }

    // LDAPS, not plain LDAP - a plain "simple bind" (unsigned, password sent over an
    // unencrypted channel) gets rejected with a generic "Invalid Credentials" error by any
    // domain controller enforcing LDAP signing/channel-binding requirements, regardless of
    // whether the password is actually correct. This is exactly what was hit testing against
    // the real domain controller this was built against - a plain :389 bind failed with every
    // DN format tried, while a signed/encrypted bind (this) succeeds with the exact same
    // credential. rejectUnauthorized: false because internal AD-issued certificates are
    // essentially always self-signed / from a private CA the Node process doesn't trust.
    const client = ldap.createClient({
      url: `ldaps://${server}:636`,
      timeout: 15000,
      connectTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false },
    });
    client.on("error", (err) => reject(err));

    client.bind(bindDn, bindPassword, (bindErr) => {
      if (bindErr) {
        client.unbind();
        reject(bindErr);
        return;
      }

      const users: AdUserEntry[] = [];
      client.search(
        baseDn,
        {
          scope: "sub",
          filter: "(&(objectCategory=person)(objectClass=user))",
          attributes: ["objectGUID", "sAMAccountName", "cn", "name", "displayName", "mail", "userPrincipalName", "department", "title", "telephoneNumber", "userAccountControl"],
          // Deliberately unpaged: this directory has well under 1000 users (AD's default
          // MaxPageSize/result-size policy), so paging isn't needed - and the paged-search
          // control is exactly the kind of thing that risks the same class of bug as the
          // webpack-bundling issue below.
        },
        (searchErr, res) => {
          if (searchErr) {
            client.unbind();
            reject(searchErr);
            return;
          }

          res.on("searchEntry", (entry) => {
            const samAccountName = firstAttrValue(entry, "sAMAccountName");
            if (!samAccountName || EXCLUDED_ACCOUNTS.has(samAccountName.toLowerCase())) return;

            const objectGuid = objectGuidAttrValue(entry);
            if (!objectGuid) return; // shouldn't happen for a real AD user object, but skip rather than crash

            // displayName is frequently left blank in smaller/less-administered AD setups
            // (confirmed true of the real directory this was built against) - cn/name reliably
            // holds the actual full name regardless, so it's the fallback, not an edge case.
            const name = firstAttrValue(entry, "displayName") ?? firstAttrValue(entry, "cn") ?? firstAttrValue(entry, "name") ?? samAccountName;
            // AD's real "mail" attribute only, never userPrincipalName - the UPN's domain
            // suffix is the AD/login domain (tulipstech.com), not this company's real email
            // domain (tulipstechnologies.com), so it's not a usable email address even though
            // it looks like one. When "mail" is empty (true for every real user here), leave
            // this null - the AD Sync page's own suggestEmail() offers the right domain instead.
            const email = firstAttrValue(entry, "mail");
            const uac = Number(firstAttrValue(entry, "userAccountControl") ?? "0");

            users.push({
              objectGuid,
              sAMAccountName: samAccountName,
              name,
              email,
              department: firstAttrValue(entry, "department"),
              title: firstAttrValue(entry, "title"),
              telephoneNumber: firstAttrValue(entry, "telephoneNumber"),
              disabled: (uac & UAC_ACCOUNTDISABLE) !== 0,
            });
          });

          res.on("error", (err) => {
            client.unbind();
            reject(err);
          });

          res.on("end", () => {
            client.unbind();
            resolve(users);
          });
        }
      );
    });
  });
}

interface AdComputerEntry {
  sAMAccountName: string;
  dnsHostName: string | null;
  operatingSystem: string | null;
  disabled: boolean;
}

// Computer/machine accounts (objectCategory=computer) - these are auto-created by Windows
// when a server or PC joins the domain, never real employees, so they're fetched and shown
// separately from fetchAdUsers()'s people (see AD Sync page) rather than mixed into the same
// staging list. Purely informational: nothing here ever creates a Device or Staff row - the
// actual server/PC still needs the LogMonitor agent installed and enrolled the normal way to
// show up as a monitored Device.
export function fetchAdComputers(): Promise<AdComputerEntry[]> {
  return new Promise((resolve, reject) => {
    const server = process.env.AD_SERVER;
    const bindDn = process.env.AD_BIND_DN;
    const bindPassword = process.env.AD_BIND_PASSWORD;
    const baseDn = process.env.AD_BASE_DN;
    if (!server || !bindDn || !bindPassword || !baseDn) {
      reject(new Error("AD_SERVER, AD_BIND_DN, AD_BIND_PASSWORD, and AD_BASE_DN must all be set"));
      return;
    }

    const client = ldap.createClient({
      url: `ldaps://${server}:636`,
      timeout: 15000,
      connectTimeout: 10000,
      tlsOptions: { rejectUnauthorized: false },
    });
    client.on("error", (err) => reject(err));

    client.bind(bindDn, bindPassword, (bindErr) => {
      if (bindErr) {
        client.unbind();
        reject(bindErr);
        return;
      }

      const computers: AdComputerEntry[] = [];
      client.search(
        baseDn,
        {
          scope: "sub",
          filter: "(objectCategory=computer)",
          attributes: ["sAMAccountName", "dNSHostName", "operatingSystem", "userAccountControl"],
        },
        (searchErr, res) => {
          if (searchErr) {
            client.unbind();
            reject(searchErr);
            return;
          }

          res.on("searchEntry", (entry) => {
            const samAccountName = firstAttrValue(entry, "sAMAccountName");
            if (!samAccountName) return;
            const uac = Number(firstAttrValue(entry, "userAccountControl") ?? "0");
            computers.push({
              sAMAccountName: samAccountName,
              dnsHostName: firstAttrValue(entry, "dNSHostName"),
              operatingSystem: firstAttrValue(entry, "operatingSystem"),
              disabled: (uac & UAC_ACCOUNTDISABLE) !== 0,
            });
          });

          res.on("error", (err) => {
            client.unbind();
            reject(err);
          });

          res.on("end", () => {
            client.unbind();
            resolve(computers);
          });
        }
      );
    });
  });
}

export interface AdSyncedComputerRow {
  id: number;
  samAccountName: string;
  dnsHostName: string | null;
  operatingSystem: string | null;
  disabled: boolean;
  adSyncedAt: string | null;
  manualIpAddress: string | null;
  detectedIpAddress: string | null;
  ipAddress: string | null;
}

// AD doesn't carry a live IP for a computer object - same as everywhere else in this app, an
// IP is normally derived live from whichever of RouterClients/SophosClients has seen that
// hostname most recently (see promoteAdSyncedUser's identical MAC-lookup-by-IP pattern, just
// the reverse direction: here matching by hostname to get an IP). SamAccountName carries a
// trailing "$" for every computer account (a standard AD convention) that RouterClients/
// SophosClients' own Hostname values never do, so it's stripped before matching.
// An admin-entered ManualIpAddress (e.g. the auto-detected match was wrong, or the machine
// isn't visible to the router/firewall poller at all) always wins over the detected one.
export async function getAdSyncedComputers(): Promise<AdSyncedComputerRow[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    SamAccountName: string;
    DnsHostName: string | null;
    OperatingSystem: string | null;
    Disabled: boolean;
    AdSyncedAt: string | null;
    ManualIpAddress: string | null;
    DetectedIpAddress: string | null;
  }>(`
    SELECT c.Id, c.SamAccountName, c.DnsHostName, c.OperatingSystem, c.Disabled, c.AdSyncedAt, c.ManualIpAddress,
      (
        SELECT TOP 1 IpAddress FROM (
          SELECT IpAddress, UpdatedAt FROM RouterClients WHERE LOWER(Hostname) = LOWER(REPLACE(c.SamAccountName, '$', ''))
          UNION ALL
          SELECT IpAddress, UpdatedAt FROM SophosClients WHERE LOWER(Hostname) = LOWER(REPLACE(c.SamAccountName, '$', ''))
        ) matches
        ORDER BY UpdatedAt DESC
      ) AS DetectedIpAddress
    FROM AdSyncedComputers c
    ORDER BY c.SamAccountName ASC
  `);
  return result.recordset.map((r) => ({
    id: r.Id,
    samAccountName: r.SamAccountName,
    dnsHostName: r.DnsHostName,
    operatingSystem: r.OperatingSystem,
    disabled: r.Disabled,
    adSyncedAt: r.AdSyncedAt,
    manualIpAddress: r.ManualIpAddress,
    detectedIpAddress: r.DetectedIpAddress,
    ipAddress: r.ManualIpAddress ?? r.DetectedIpAddress,
  }));
}

// Reuses the same permissive shape check as setAdSyncedUserIp - this is an admin-entered
// hint/override, not a security boundary.
const COMPUTER_IP_ADDRESS_PATTERN = /^[0-9a-fA-F.:]{2,45}$/;

export async function setAdSyncedComputerIp(id: number, ipAddress: string | null): Promise<boolean> {
  if (ipAddress !== null && !COMPUTER_IP_ADDRESS_PATTERN.test(ipAddress)) {
    throw new Error(`"${ipAddress}" does not look like a valid IP address`);
  }
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .input("ip", sql.VarChar, ipAddress)
    .query("UPDATE AdSyncedComputers SET ManualIpAddress = @ip WHERE Id = @id");
  return (result.rowsAffected[0] ?? 0) > 0;
}

// Upsert-by-SamAccountName, not full delete+reinsert - preserves each row's admin-entered
// ManualIpAddress across syncs (a delete+reinsert would silently wipe it every time). Rows for
// computer accounts no longer present in AD at all are removed, same non-destructive
// reasoning as the "purely informational, nothing downstream depends on it" comment this
// function had before - just now it also needs to protect one admin-owned field.
async function syncAdComputers(): Promise<number> {
  const computers = await fetchAdComputers();
  const db = await getDb();

  const seenNames: string[] = [];
  for (const c of computers) {
    seenNames.push(c.sAMAccountName);
    await db
      .request()
      .input("sam", sql.NVarChar, c.sAMAccountName)
      .input("dns", sql.NVarChar, c.dnsHostName)
      .input("os", sql.NVarChar, c.operatingSystem)
      .input("disabled", sql.Bit, c.disabled)
      .query(`
        MERGE AdSyncedComputers AS target
        USING (SELECT @sam AS SamAccountName) AS source
        ON target.SamAccountName = source.SamAccountName
        WHEN MATCHED THEN
          UPDATE SET DnsHostName = @dns, OperatingSystem = @os, Disabled = @disabled, AdSyncedAt = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (SamAccountName, DnsHostName, OperatingSystem, Disabled, AdSyncedAt)
          VALUES (@sam, @dns, @os, @disabled, SYSUTCDATETIME());
      `);
  }

  if (seenNames.length > 0) {
    const seenNamesJson = JSON.stringify(seenNames);
    await db
      .request()
      .input("seenNamesJson", sql.NVarChar(sql.MAX), seenNamesJson)
      .query("DELETE FROM AdSyncedComputers WHERE SamAccountName NOT IN (SELECT [value] FROM OPENJSON(@seenNamesJson))");
  }

  return computers.length;
}

export interface AdSyncResult {
  created: number;
  matchedByGuid: number;
  markedDisabled: number;
  total: number;
  computers: number;
}

// Upserts fetched AD users into AdSyncedUsers - deliberately NOT the Staff table (the
// Employee list). AD-discovered accounts are a review/staging list; nothing here ever
// creates or modifies a real employee record. An admin decides separately who's a real
// employee and links their device - this table exists so they have something to review
// first, including a place to record a device IP manually per person ahead of that
// decision (see ManualIpAddress, set via the admin API, never touched by this sync).
// Never hard-deletes: an AD-synced row whose account is gone or disabled just gets
// AdDisabled = 1.
export async function syncActiveDirectory(): Promise<AdSyncResult> {
  const adUsers = await fetchAdUsers();

  // Hard safety guard: a real organization always has at least one enabled user account
  // (this sync's own service account, if nothing else). Zero results is virtually always a
  // broken/misconfigured fetch, not "every employee just vanished from AD" - proceeding past
  // this would mark every previously-synced row AdDisabled = 1 in the "mark missing as
  // disabled" step below, which is exactly the incident this guard exists to prevent (hit
  // live while building this: an environment-specific issue made one call path return zero
  // results, and every real employee got wrongly flagged disabled before this guard existed).
  if (adUsers.length === 0) {
    throw new Error("AD query returned zero users - refusing to mark existing rows as disabled. This almost always means the fetch itself is broken, not that AD is empty.");
  }

  const db = await getDb();

  let created = 0;
  let matchedByGuid = 0;

  const seenGuids: string[] = [];

  for (const u of adUsers) {
    seenGuids.push(u.objectGuid);

    const byGuid = await db
      .request()
      .input("guid", sql.VarChar, u.objectGuid)
      .query<{ Id: number }>("SELECT Id FROM AdSyncedUsers WHERE AdObjectGuid = @guid");

    if (byGuid.recordset[0]) {
      matchedByGuid++;
      await db
        .request()
        .input("id", sql.Int, byGuid.recordset[0].Id)
        .input("name", sql.NVarChar, u.name)
        .input("email", sql.NVarChar, u.email)
        .input("department", sql.NVarChar, u.department)
        .input("position", sql.NVarChar, u.title)
        .input("phone", sql.NVarChar, u.telephoneNumber)
        .input("samAccountName", sql.NVarChar, u.sAMAccountName)
        .input("disabled", sql.Bit, u.disabled)
        .query(`
          UPDATE AdSyncedUsers
          SET Name = @name, Email = @email, Department = @department, Position = @position, Phone = @phone,
              AdSamAccountName = @samAccountName, AdDisabled = @disabled, AdSyncedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
          WHERE Id = @id
        `);
      continue;
    }

    created++;
    await db
      .request()
      .input("name", sql.NVarChar, u.name)
      .input("email", sql.NVarChar, u.email)
      .input("department", sql.NVarChar, u.department)
      .input("position", sql.NVarChar, u.title)
      .input("phone", sql.NVarChar, u.telephoneNumber)
      .input("guid", sql.VarChar, u.objectGuid)
      .input("samAccountName", sql.NVarChar, u.sAMAccountName)
      .input("disabled", sql.Bit, u.disabled)
      .query(`
        INSERT INTO AdSyncedUsers (Name, Email, Department, Position, Phone, AdObjectGuid, AdSamAccountName, AdDisabled, AdSyncedAt)
        VALUES (@name, @email, @department, @position, @phone, @guid, @samAccountName, @disabled, SYSUTCDATETIME())
      `);
  }

  // Anything previously synced from AD that didn't show up in this run at all (removed
  // outright, not just disabled) - mark disabled too, same non-destructive handling.
  const seenGuidsJson = JSON.stringify(seenGuids);
  const markResult = await db
    .request()
    .input("seenGuidsJson", sql.NVarChar(sql.MAX), seenGuidsJson)
    .query(`
      UPDATE AdSyncedUsers
      SET AdDisabled = 1, AdSyncedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
      WHERE AdDisabled = 0
        AND AdObjectGuid NOT IN (SELECT [value] FROM OPENJSON(@seenGuidsJson))
    `);

  // Computer accounts are a separate, purely-informational fetch - a failure here (or a
  // legitimately-empty result, unlike the people guard above: an org can have zero
  // domain-joined machines) shouldn't block or roll back the people sync that already
  // succeeded above.
  let computerCount = 0;
  try {
    computerCount = await syncAdComputers();
  } catch {
    // leave AdSyncedComputers as whatever it was from the last successful run
  }

  return {
    created,
    matchedByGuid,
    markedDisabled: markResult.rowsAffected[0] ?? 0,
    total: adUsers.length,
    computers: computerCount,
  };
}

export interface AdSyncedUserRow {
  id: number;
  name: string;
  samAccountName: string | null;
  email: string | null;
  adDisabled: boolean;
  adSyncedAt: string | null;
  manualIpAddress: string | null;
  note: string | null;
}

export async function getAdSyncedUsers(): Promise<AdSyncedUserRow[]> {
  const db = await getDb();
  const result = await db.query<{
    Id: number;
    Name: string;
    AdSamAccountName: string | null;
    Email: string | null;
    AdDisabled: boolean;
    AdSyncedAt: string | null;
    ManualIpAddress: string | null;
    Note: string | null;
  }>("SELECT Id, Name, AdSamAccountName, Email, AdDisabled, AdSyncedAt, ManualIpAddress, Note FROM AdSyncedUsers ORDER BY AdSyncedAt DESC");
  return result.recordset.map((r) => ({
    id: r.Id,
    name: r.Name,
    samAccountName: r.AdSamAccountName,
    email: r.Email,
    adDisabled: r.AdDisabled,
    adSyncedAt: r.AdSyncedAt,
    manualIpAddress: r.ManualIpAddress,
    note: r.Note,
  }));
}

// Simple, deliberately permissive IPv4/IPv6 shape check - this is an admin-entered hint for
// eventually linking this person to a device, not a security boundary, so it doesn't need to
// be exhaustively strict.
const IP_ADDRESS_PATTERN = /^[0-9a-fA-F.:]{2,45}$/;

export async function setAdSyncedUserIp(id: number, ipAddress: string | null): Promise<boolean> {
  if (ipAddress !== null && !IP_ADDRESS_PATTERN.test(ipAddress)) {
    throw new Error(`"${ipAddress}" does not look like a valid IP address`);
  }
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .input("ip", sql.VarChar, ipAddress)
    .query("UPDATE AdSyncedUsers SET ManualIpAddress = @ip, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  return (result.rowsAffected[0] ?? 0) > 0;
}

// Deliberately permissive shape check, same reasoning as IP_ADDRESS_PATTERN above - this is
// an admin-entered/admin-corrected value (AD's own "mail" attribute is empty for this org's
// real users, see fetchAdUsers), not a value AD itself guarantees the format of.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function setAdSyncedUserEmail(id: number, email: string | null): Promise<boolean> {
  if (email !== null && !EMAIL_PATTERN.test(email)) {
    throw new Error(`"${email}" does not look like a valid email address`);
  }
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .input("email", sql.NVarChar, email)
    .query("UPDATE AdSyncedUsers SET Email = @email, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  return (result.rowsAffected[0] ?? 0) > 0;
}

const NOTE_MAX_LENGTH = 1000; // matches AdSyncedUsers.Note NVARCHAR(1000)

export async function setAdSyncedUserNote(id: number, note: string | null): Promise<boolean> {
  if (note !== null && note.length > NOTE_MAX_LENGTH) {
    throw new Error(`Note is too long (max ${NOTE_MAX_LENGTH} characters)`);
  }
  const db = await getDb();
  const result = await db
    .request()
    .input("id", sql.Int, id)
    .input("note", sql.NVarChar, note)
    .query("UPDATE AdSyncedUsers SET Note = @note, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
  return (result.rowsAffected[0] ?? 0) > 0;
}

// Removes a person from the review list without creating an employee - for entries an admin
// doesn't want cluttering this list. Only deletes the staging row; the next AD sync re-adds
// them if their account is still active in Active Directory (see fetchAdUsers's upsert).
export async function deleteAdSyncedUser(id: number): Promise<boolean> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query("DELETE FROM AdSyncedUsers WHERE Id = @id");
  return (result.rowsAffected[0] ?? 0) > 0;
}

export class DuplicateStaffMacError extends Error {}

export interface PromoteResult {
  staffId: number;
  macAddress: string | null;
}

// Turns an AD-discovered person into a real employee: creates a Staff row from what AD
// sync already collected (name/email/department/position/phone), then removes them from
// the AdSyncedUsers staging list - once promoted, they're a real employee, not a pending
// AD account anymore, so re-promoting or accidentally double-creating isn't possible.
//
// Staff doesn't have an IP column of its own (an employee's "current IP" is always derived
// live from Devices/RouterClients/SophosClients via their MacAddress, same as everywhere
// else in this app) - so the admin-entered ManualIpAddress is used here as a one-time
// lookup key against RouterClients/SophosClients (whichever has a matching row) to find the
// device's actual MAC address, which is what actually gets stored on the new Staff row. If
// no IP was set, or nothing on the network currently reports that IP, the new employee is
// still created - just without a device linked yet, exactly like adding one manually today.
export async function promoteAdSyncedUser(id: number): Promise<PromoteResult> {
  const db = await getDb();

  const userResult = await db
    .request()
    .input("id", sql.Int, id)
    .query<{ Name: string; Email: string | null; Department: string | null; Position: string | null; Phone: string | null; ManualIpAddress: string | null }>(
      "SELECT Name, Email, Department, Position, Phone, ManualIpAddress FROM AdSyncedUsers WHERE Id = @id"
    );
  const user = userResult.recordset[0];
  if (!user) {
    throw new Error("Person not found");
  }

  let macAddress: string | null = null;
  if (user.ManualIpAddress) {
    const macResult = await db
      .request()
      .input("ip", sql.VarChar, user.ManualIpAddress)
      .query<{ MacAddress: string | null }>(`
        SELECT TOP 1 MacAddress FROM (
          SELECT MacAddress, UpdatedAt FROM RouterClients WHERE IpAddress = @ip AND MacAddress IS NOT NULL
          UNION ALL
          SELECT MacAddress, UpdatedAt FROM SophosClients WHERE IpAddress = @ip AND MacAddress IS NOT NULL
        ) matches
        ORDER BY UpdatedAt DESC
      `);
    macAddress = macResult.recordset[0]?.MacAddress ?? null;
  }

  let staffId: number;
  try {
    const insertResult = await db
      .request()
      .input("name", sql.NVarChar, user.Name)
      .input("email", sql.NVarChar, user.Email)
      .input("department", sql.NVarChar, user.Department)
      .input("position", sql.NVarChar, user.Position)
      .input("phone", sql.NVarChar, user.Phone)
      .input("macAddress", sql.VarChar, macAddress)
      .query<{ Id: number }>(`
        INSERT INTO Staff (Name, Email, Department, Position, Phone, MacAddress)
        OUTPUT INSERTED.Id
        VALUES (@name, @email, @department, @position, @phone, @macAddress)
      `);
    staffId = insertResult.recordset[0].Id;
  } catch (err) {
    // The looked-up MAC address is already assigned to a different Staff row (e.g. the
    // device was previously an ex-employee's) - surface this clearly rather than a raw SQL
    // constraint error, and don't remove the AdSyncedUsers row, so nothing is lost.
    if (err instanceof Error && err.message.includes("UX_Staff_MacAddress")) {
      throw new DuplicateStaffMacError(
        `The device at ${user.ManualIpAddress} (MAC ${macAddress}) is already linked to a different employee - resolve that first, or clear the IP here and promote without a device link.`
      );
    }
    throw err;
  }

  await db.request().input("id", sql.Int, id).query("DELETE FROM AdSyncedUsers WHERE Id = @id");

  return { staffId, macAddress };
}

export interface AdUserPingTarget {
  id: number;
  name: string;
  ipAddress: string;
}

// Only active (non-disabled) AD-synced people who have an admin-entered device IP - unlike
// AdSyncedComputers, this table has no auto-detected IP (no RouterClients/SophosClients
// hostname match attempted for people), so ManualIpAddress is the only address this can ever
// ping. Anyone without one simply doesn't appear in the Overview page's online/offline widget.
export async function getActiveAdUsersForPing(): Promise<AdUserPingTarget[]> {
  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string; ManualIpAddress: string }>(
    "SELECT Id, Name, ManualIpAddress FROM AdSyncedUsers WHERE AdDisabled = 0 AND ManualIpAddress IS NOT NULL ORDER BY Name ASC"
  );
  return result.recordset.map((r) => ({ id: r.Id, name: r.Name, ipAddress: r.ManualIpAddress }));
}

// Export column specs + row-mapping, feeding the shared buildCsv/buildExcel/buildPdf/
// buildWordDoc renderers in itAssetLogsheet/exportHelpers - same generic {header,key,width}[]
// + Record<string,string>[] shape already used for every other list export in this app.
export const AD_USER_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Name", key: "name", width: 22 },
  { header: "Username (Domain Login)", key: "samAccountName", width: 20 },
  { header: "Email", key: "email", width: 26 },
  { header: "IP Address", key: "ip", width: 14 },
  { header: "Status", key: "status", width: 14 },
  { header: "Note", key: "note", width: 30 },
  { header: "Last Synced", key: "adSyncedAt", width: 18 },
];

export function buildAdUserExportRows(users: AdSyncedUserRow[]): Record<string, string>[] {
  return users.map((u) => ({
    name: u.name,
    samAccountName: u.samAccountName ?? "",
    email: u.email ?? "",
    ip: u.manualIpAddress ?? "",
    status: u.adDisabled ? "Disabled in AD" : "Active",
    note: u.note ?? "",
    // adSyncedAt is typed string but the mssql driver actually returns AdSyncedAt (a
    // DATETIME2 column, not CONVERT()'d in the query) as a native Date object - new Date(...)
    // tolerates both a Date and an ISO string as input, so this is safe either way.
    adSyncedAt: u.adSyncedAt ? new Date(u.adSyncedAt).toISOString() : "",
  }));
}

export const AD_COMPUTER_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Name", key: "name", width: 20 },
  { header: "DNS Hostname", key: "dnsHostName", width: 24 },
  { header: "IP Address", key: "ip", width: 14 },
  { header: "Operating System", key: "os", width: 22 },
  { header: "Status", key: "status", width: 14 },
];

export function buildAdComputerExportRows(computers: AdSyncedComputerRow[]): Record<string, string>[] {
  return computers.map((c) => ({
    name: c.samAccountName.replace(/\$$/, ""),
    dnsHostName: c.dnsHostName ?? "",
    ip: c.ipAddress ?? "",
    os: c.operatingSystem ?? "",
    status: c.disabled ? "Disabled in AD" : "Active",
  }));
}



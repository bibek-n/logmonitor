import ldap from "ldapjs";

// Writes to on-prem Active Directory (TulipsTech.com, DC at 192.168.1.3) to disable an
// employee's domain login - a real Windows/VPN-level account, not a SaaS tool, so this is more
// consequential than the other systems in this module. Uses the SAME confirmed-working LDAPS
// connection pattern as activeDirectorySync.ts (plain :389 is rejected by this DC's signing
// requirements; ldaps://host:636 with rejectUnauthorized:false - an internal CA - works), but a
// SEPARATE, write-scoped bind account (svc-offboard) rather than reusing AD Sync's
// deliberately read-only svc-logmonitor. That account was delegated Write-Property on
// userAccountControl only, scoped to OU=Users,OU=TulipsTech-Corp (real employee accounts),
// never granted at the domain root - Privileged-Accounts, Service-Accounts, Tier0-Admin, and
// Domain Controllers are all outside that OU and this account cannot touch them.

export class ActiveDirectoryError extends Error {}

const UAC_ACCOUNTDISABLE = 0x2;

// Standard LDAP filter escaping (RFC 4515) - sAMAccountName here is admin-entered (the Staff
// mapping field), not attacker input, but this is cheap defense-in-depth against a stray
// *, (, ), \, or NUL breaking or widening the search filter.
function escapeLdapFilterValue(value: string): string {
  return value.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
}

function firstAttrValue(entry: ldap.SearchEntry, name: string): string | null {
  const attr = entry.attributes.find((a) => a.type.toLowerCase() === name.toLowerCase());
  if (!attr || attr.values.length === 0) return null;
  const v = attr.values[0];
  return typeof v === "string" && v ? v : null;
}

function withClient<T>(server: string, bindDn: string, bindPassword: string, fn: (client: ldap.Client) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
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
        reject(new ActiveDirectoryError(`AD bind failed: ${bindErr.message}`));
        return;
      }
      fn(client)
        .then((result) => {
          client.unbind();
          resolve(result);
        })
        .catch((err) => {
          client.unbind();
          reject(err);
        });
    });
  });
}

function findUser(client: ldap.Client, baseDn: string, sAMAccountName: string): Promise<{ dn: string; userAccountControl: number } | null> {
  return new Promise((resolve, reject) => {
    client.search(
      baseDn,
      {
        scope: "sub",
        filter: `(&(objectCategory=person)(objectClass=user)(sAMAccountName=${escapeLdapFilterValue(sAMAccountName)}))`,
        attributes: ["userAccountControl"],
      },
      (searchErr, res) => {
        if (searchErr) {
          reject(new ActiveDirectoryError(`AD search failed: ${searchErr.message}`));
          return;
        }
        let found: { dn: string; userAccountControl: number } | null = null;
        res.on("searchEntry", (entry) => {
          // entry.objectName is the DN as delivered by the LDAP protocol response itself
          // (confirmed in @ldapjs/messages' SearchResultEntry) - more reliable than depending on
          // "distinguishedName" also coming back as a requested attribute value.
          const dn = entry.objectName.toString();
          const uac = Number(firstAttrValue(entry, "userAccountControl") ?? "0");
          found = { dn, userAccountControl: uac };
        });
        res.on("error", (err) => reject(new ActiveDirectoryError(`AD search failed: ${err.message}`)));
        res.on("end", () => resolve(found));
      }
    );
  });
}

export interface AdDisableResult {
  alreadyDisabled: boolean;
  distinguishedName: string;
}

export async function disableAdAccount(server: string, baseDn: string, bindDn: string, bindPassword: string, sAMAccountName: string): Promise<AdDisableResult> {
  return withClient(server, bindDn, bindPassword, async (client) => {
    const user = await findUser(client, baseDn, sAMAccountName);
    if (!user) throw new ActiveDirectoryError(`No AD account found for sAMAccountName "${sAMAccountName}".`);

    if ((user.userAccountControl & UAC_ACCOUNTDISABLE) !== 0) {
      return { alreadyDisabled: true, distinguishedName: user.dn };
    }

    const newUac = user.userAccountControl | UAC_ACCOUNTDISABLE;
    await new Promise<void>((resolve, reject) => {
      const change = new ldap.Change({
        operation: "replace",
        modification: { type: "userAccountControl", values: [String(newUac)] },
      });
      client.modify(user.dn, change, (modErr) => {
        if (modErr) reject(new ActiveDirectoryError(`AD modify failed: ${modErr.message}`));
        else resolve();
      });
    });

    return { alreadyDisabled: false, distinguishedName: user.dn };
  });
}

// Verifies the account exists and reports whether it's currently enabled/disabled - used by the
// settings page's test action so a bad bind DN/password/OU-scope surfaces immediately rather than
// during a real offboarding.
export async function lookupAdAccount(server: string, baseDn: string, bindDn: string, bindPassword: string, sAMAccountName: string): Promise<{ found: boolean; disabled: boolean; distinguishedName: string | null }> {
  return withClient(server, bindDn, bindPassword, async (client) => {
    const user = await findUser(client, baseDn, sAMAccountName);
    if (!user) return { found: false, disabled: false, distinguishedName: null };
    return { found: true, disabled: (user.userAccountControl & UAC_ACCOUNTDISABLE) !== 0, distinguishedName: user.dn };
  });
}

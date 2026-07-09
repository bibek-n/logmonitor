import { getDb, sql } from "./db";

export interface NetworkMatch {
  source: "mikrotik" | "sophos";
  ip: string | null;
  hostname: string | null;
}

export interface StaffMatch {
  id: number;
  name: string;
}

export interface DeviceMacMatch {
  networkMatches: NetworkMatch[];
  suggestedStaff: StaffMatch | null;
}

// Cross-references an enrolled agent's collected MAC address against the network
// presence tables already populated by the MikroTik/Sophos pollers (RouterClients/
// SophosClients), and against Staff's own MAC-based device mapping — so an admin
// enrolling a new agent can see "this MAC is already known as DESKTOP-ABC123 on
// 192.168.20.14" and, if that MAC is already tied to a staff record, a one-click
// suggested assignment instead of guessing which employee a device belongs to.
export async function matchDeviceByMac(mac: string | null): Promise<DeviceMacMatch> {
  if (!mac) return { networkMatches: [], suggestedStaff: null };

  const db = await getDb();
  const [routerResult, sophosResult, staffResult] = await Promise.all([
    db
      .request()
      .input("mac", sql.VarChar, mac)
      .query<{ IpAddress: string; Hostname: string | null }>(
        "SELECT TOP 1 IpAddress, Hostname FROM RouterClients WHERE UPPER(MacAddress) = UPPER(@mac) ORDER BY UpdatedAt DESC"
      ),
    db
      .request()
      .input("mac", sql.VarChar, mac)
      .query<{ IpAddress: string; Hostname: string | null }>(
        "SELECT TOP 1 IpAddress, Hostname FROM SophosClients WHERE UPPER(MacAddress) = UPPER(@mac) ORDER BY UpdatedAt DESC"
      ),
    db
      .request()
      .input("mac", sql.VarChar, mac)
      .query<{ Id: number; Name: string }>("SELECT TOP 1 Id, Name FROM Staff WHERE UPPER(MacAddress) = UPPER(@mac)"),
  ]);

  const networkMatches: NetworkMatch[] = [];
  if (routerResult.recordset[0]) {
    networkMatches.push({ source: "mikrotik", ip: routerResult.recordset[0].IpAddress, hostname: routerResult.recordset[0].Hostname });
  }
  if (sophosResult.recordset[0]) {
    networkMatches.push({ source: "sophos", ip: sophosResult.recordset[0].IpAddress, hostname: sophosResult.recordset[0].Hostname });
  }

  const suggestedStaff = staffResult.recordset[0]
    ? { id: staffResult.recordset[0].Id, name: staffResult.recordset[0].Name }
    : null;

  return { networkMatches, suggestedStaff };
}

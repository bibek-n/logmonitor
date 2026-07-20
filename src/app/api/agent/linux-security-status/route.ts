import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

interface OpenPortPayload {
  protocol?: string;
  address?: string;
  port?: number;
  process?: string;
}
interface Fail2banJailPayload {
  jail?: string;
  currentlyBanned?: number;
  totalBanned?: number;
}

// Posted every linuxSecurityPollInterval (5m) by the agent, only on Linux devices (see
// LinuxSecurityDetected()'s runtime.GOOS=="linux" gate) - a Windows Server agent never calls
// this route. The scalar summary fields (SSH/firewall/SELinux/AppArmor/permission/sudo
// counts) are a latest-snapshot UPSERT into one row per device; open ports, fail2ban jails,
// and the sample permission/sudo findings are all "what does it look like right now"
// delete-then-insert child tables, same pattern as IisAppPools/IisSites.
export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const detected = body.detected === true;
  const db = await getDb();

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("detected", sql.Bit, detected)
    .query("UPDATE Devices SET LinuxSecurityDetected = @detected, LastLinuxSecurityCheckAt = SYSUTCDATETIME() WHERE DeviceId = @deviceId");

  if (!detected) {
    return NextResponse.json({ ok: true });
  }

  const openPorts: OpenPortPayload[] = Array.isArray(body.openPorts) ? body.openPorts : [];
  const fail2banJails: Fail2banJailPayload[] = Array.isArray(body.fail2banJails) ? body.fail2banJails : [];
  const worldWritableSamples: string[] = Array.isArray(body.worldWritableSamples) ? body.worldWritableSamples : [];
  const suidBinarySamples: string[] = Array.isArray(body.suidBinarySamples) ? body.suidBinarySamples : [];
  const sudoNopasswdEntries: string[] = Array.isArray(body.sudoNopasswdEntries) ? body.sudoNopasswdEntries : [];

  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("sshPort", sql.Int, typeof body.sshPort === "number" ? body.sshPort : null)
    .input("sshPermitRootLogin", sql.VarChar, typeof body.sshPermitRootLogin === "string" ? body.sshPermitRootLogin : null)
    .input("sshPasswordAuthentication", sql.VarChar, typeof body.sshPasswordAuthentication === "string" ? body.sshPasswordAuthentication : null)
    .input("sshServiceActive", sql.Bit, typeof body.sshServiceActive === "boolean" ? body.sshServiceActive : null)
    .input("firewallType", sql.VarChar, typeof body.firewallType === "string" ? body.firewallType : null)
    .input("firewallActive", sql.Bit, typeof body.firewallActive === "boolean" ? body.firewallActive : null)
    .input("firewallRuleCount", sql.Int, typeof body.firewallRuleCount === "number" ? body.firewallRuleCount : null)
    .input("fail2banInstalled", sql.Bit, typeof body.fail2banInstalled === "boolean" ? body.fail2banInstalled : null)
    .input("fail2banActive", sql.Bit, typeof body.fail2banActive === "boolean" ? body.fail2banActive : null)
    .input("selinuxStatus", sql.VarChar, typeof body.selinuxStatus === "string" ? body.selinuxStatus : null)
    .input("apparmorStatus", sql.VarChar, typeof body.apparmorStatus === "string" ? body.apparmorStatus : null)
    .input("apparmorEnforceCount", sql.Int, typeof body.apparmorEnforceCount === "number" ? body.apparmorEnforceCount : null)
    .input("apparmorComplainCount", sql.Int, typeof body.apparmorComplainCount === "number" ? body.apparmorComplainCount : null)
    .input("worldWritableFileCount", sql.Int, typeof body.worldWritableFileCount === "number" ? body.worldWritableFileCount : null)
    .input("suidBinaryCount", sql.Int, typeof body.suidBinaryCount === "number" ? body.suidBinaryCount : null)
    .input("sudoNopasswdCount", sql.Int, typeof body.sudoNopasswdCount === "number" ? body.sudoNopasswdCount : null)
    .query(`
      MERGE LinuxSecurityStatus AS target
      USING (SELECT @deviceId AS DeviceId) AS src ON target.DeviceId = src.DeviceId
      WHEN MATCHED THEN UPDATE SET
        SshPort = @sshPort, SshPermitRootLogin = @sshPermitRootLogin, SshPasswordAuthentication = @sshPasswordAuthentication,
        SshServiceActive = @sshServiceActive, FirewallType = @firewallType, FirewallActive = @firewallActive,
        FirewallRuleCount = @firewallRuleCount, Fail2banInstalled = @fail2banInstalled, Fail2banActive = @fail2banActive,
        SelinuxStatus = @selinuxStatus, ApparmorStatus = @apparmorStatus, ApparmorEnforceCount = @apparmorEnforceCount,
        ApparmorComplainCount = @apparmorComplainCount, WorldWritableFileCount = @worldWritableFileCount,
        SuidBinaryCount = @suidBinaryCount, SudoNopasswdCount = @sudoNopasswdCount, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (
        DeviceId, SshPort, SshPermitRootLogin, SshPasswordAuthentication, SshServiceActive,
        FirewallType, FirewallActive, FirewallRuleCount, Fail2banInstalled, Fail2banActive,
        SelinuxStatus, ApparmorStatus, ApparmorEnforceCount, ApparmorComplainCount,
        WorldWritableFileCount, SuidBinaryCount, SudoNopasswdCount
      ) VALUES (
        @deviceId, @sshPort, @sshPermitRootLogin, @sshPasswordAuthentication, @sshServiceActive,
        @firewallType, @firewallActive, @firewallRuleCount, @fail2banInstalled, @fail2banActive,
        @selinuxStatus, @apparmorStatus, @apparmorEnforceCount, @apparmorComplainCount,
        @worldWritableFileCount, @suidBinaryCount, @sudoNopasswdCount
      );
    `);

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM LinuxOpenPorts WHERE DeviceId = @deviceId");
  for (const p of openPorts) {
    if (typeof p.port !== "number") continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("protocol", sql.VarChar, p.protocol ?? "tcp")
      .input("address", sql.VarChar, p.address ?? "")
      .input("port", sql.Int, p.port)
      .input("processName", sql.NVarChar, p.process ?? null)
      .query(`
        INSERT INTO LinuxOpenPorts (DeviceId, Protocol, Address, Port, ProcessName)
        VALUES (@deviceId, @protocol, @address, @port, @processName)
      `);
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM LinuxFail2banJails WHERE DeviceId = @deviceId");
  for (const j of fail2banJails) {
    if (!j.jail) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("jailName", sql.NVarChar, j.jail)
      .input("currentlyBanned", sql.Int, typeof j.currentlyBanned === "number" ? j.currentlyBanned : 0)
      .input("totalBanned", sql.Int, typeof j.totalBanned === "number" ? j.totalBanned : 0)
      .query(`
        INSERT INTO LinuxFail2banJails (DeviceId, JailName, CurrentlyBanned, TotalBanned)
        VALUES (@deviceId, @jailName, @currentlyBanned, @totalBanned)
      `);
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM LinuxPermissionFindings WHERE DeviceId = @deviceId");
  for (const path of worldWritableSamples) {
    if (!path) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("issueType", sql.VarChar, "world_writable")
      .input("path", sql.NVarChar, path)
      .query("INSERT INTO LinuxPermissionFindings (DeviceId, IssueType, Path) VALUES (@deviceId, @issueType, @path)");
  }
  for (const path of suidBinarySamples) {
    if (!path) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("issueType", sql.VarChar, "suid")
      .input("path", sql.NVarChar, path)
      .query("INSERT INTO LinuxPermissionFindings (DeviceId, IssueType, Path) VALUES (@deviceId, @issueType, @path)");
  }

  await db.request().input("deviceId", sql.VarChar, device.deviceId).query("DELETE FROM LinuxSudoNopasswdEntries WHERE DeviceId = @deviceId");
  for (const entry of sudoNopasswdEntries) {
    if (!entry) continue;
    await db
      .request()
      .input("deviceId", sql.VarChar, device.deviceId)
      .input("entry", sql.NVarChar, entry)
      .query("INSERT INTO LinuxSudoNopasswdEntries (DeviceId, Entry) VALUES (@deviceId, @entry)");
  }

  return NextResponse.json({ ok: true });
}

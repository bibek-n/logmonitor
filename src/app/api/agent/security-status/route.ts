import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";
import { raiseAlertIfNew, resolveAlert } from "@/lib/deviceAlerts";

export async function POST(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (!device) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const db = await getDb();
  const existing = await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .query("SELECT 1 FROM DeviceSecurityStatus WHERE DeviceId = @deviceId");

  const request = db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("antivirusStatus", sql.NVarChar, body.antivirusStatus ?? null)
    .input("defenderStatus", sql.NVarChar, body.defenderStatus ?? null)
    .input("firewallEnabled", sql.Bit, body.firewallEnabled ?? null)
    .input("firewallRulesCount", sql.Int, body.firewallRulesCount ?? null)
    .input("bitLockerStatus", sql.NVarChar, body.bitLockerStatus ?? null)
    .input("luksStatus", sql.NVarChar, body.luksStatus ?? null)
    .input("secureBootEnabled", sql.Bit, body.secureBootEnabled ?? null)
    .input("tpmVersion", sql.NVarChar, body.tpmVersion ?? null)
    .input("selinuxStatus", sql.NVarChar, body.selinuxStatus ?? null)
    .input("apparmorStatus", sql.NVarChar, body.apparmorStatus ?? null)
    .input("failedLoginCount24h", sql.Int, body.failedLoginCount24h ?? null);

  if (existing.recordset.length > 0) {
    await request.query(`
      UPDATE DeviceSecurityStatus SET
        AntivirusStatus = @antivirusStatus, DefenderStatus = @defenderStatus,
        FirewallEnabled = @firewallEnabled, FirewallRulesCount = @firewallRulesCount,
        BitLockerStatus = @bitLockerStatus, LuksStatus = @luksStatus,
        SecureBootEnabled = @secureBootEnabled, TpmVersion = @tpmVersion,
        SELinuxStatus = @selinuxStatus, AppArmorStatus = @apparmorStatus,
        FailedLoginCount24h = @failedLoginCount24h, UpdatedAt = SYSUTCDATETIME()
      WHERE DeviceId = @deviceId
    `);
  } else {
    await request.query(`
      INSERT INTO DeviceSecurityStatus
        (DeviceId, AntivirusStatus, DefenderStatus, FirewallEnabled, FirewallRulesCount,
         BitLockerStatus, LuksStatus, SecureBootEnabled, TpmVersion, SELinuxStatus,
         AppArmorStatus, FailedLoginCount24h)
      VALUES
        (@deviceId, @antivirusStatus, @defenderStatus, @firewallEnabled, @firewallRulesCount,
         @bitLockerStatus, @luksStatus, @secureBootEnabled, @tpmVersion, @selinuxStatus,
         @apparmorStatus, @failedLoginCount24h)
    `);
  }

  if (body.firewallEnabled === false) {
    await raiseAlertIfNew(device.deviceId, "firewall_disabled", "warning", "Firewall is disabled on this device.");
  } else if (body.firewallEnabled === true) {
    await resolveAlert(device.deviceId, "firewall_disabled");
  }

  if (body.defenderStatus === "disabled" || body.antivirusStatus === "disabled") {
    await raiseAlertIfNew(device.deviceId, "av_disabled", "critical", "Antivirus/Defender is disabled on this device.");
  } else if (body.defenderStatus === "enabled" || body.antivirusStatus === "enabled") {
    await resolveAlert(device.deviceId, "av_disabled");
  }

  return NextResponse.json({ ok: true });
}

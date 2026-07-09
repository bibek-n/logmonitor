import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { authenticateDevice } from "@/lib/agentAuth";

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
    .query("SELECT 1 FROM DeviceNetworkInfo WHERE DeviceId = @deviceId");

  const request = db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("currentIp", sql.VarChar, body.currentIp || null)
    .input("publicIp", sql.VarChar, body.publicIp || null)
    .input("gatewayIp", sql.VarChar, body.gatewayIp || null)
    .input("dnsServers", sql.NVarChar, body.dnsServers || null)
    .input("wifiSsid", sql.NVarChar, body.wifiSsid || null)
    .input("vpnActive", sql.Bit, body.vpnActive ?? null)
    .input("ethernetConnected", sql.Bit, body.ethernetConnected ?? null)
    .input("openPortsJson", sql.NVarChar, JSON.stringify(body.openPorts ?? []))
    .input("listeningPortsJson", sql.NVarChar, JSON.stringify(body.listeningPorts ?? []));

  // Also update Devices.LastIp / CurrentUser-adjacent network fields kept there for
  // quick display without a join, matching how the dashboard list page reads LastIp.
  await db
    .request()
    .input("deviceId", sql.VarChar, device.deviceId)
    .input("currentIp", sql.VarChar, body.currentIp || null)
    .query("UPDATE Devices SET LastIp = COALESCE(@currentIp, LastIp) WHERE DeviceId = @deviceId");

  if (existing.recordset.length > 0) {
    await request.query(`
      UPDATE DeviceNetworkInfo SET
        CurrentIp = @currentIp, PublicIp = @publicIp, GatewayIp = @gatewayIp,
        DnsServers = @dnsServers, WifiSsid = @wifiSsid, VpnActive = @vpnActive,
        EthernetConnected = @ethernetConnected, OpenPortsJson = @openPortsJson,
        ListeningPortsJson = @listeningPortsJson, UpdatedAt = SYSUTCDATETIME()
      WHERE DeviceId = @deviceId
    `);
  } else {
    await request.query(`
      INSERT INTO DeviceNetworkInfo
        (DeviceId, CurrentIp, PublicIp, GatewayIp, DnsServers, WifiSsid, VpnActive,
         EthernetConnected, OpenPortsJson, ListeningPortsJson)
      VALUES
        (@deviceId, @currentIp, @publicIp, @gatewayIp, @dnsServers, @wifiSsid, @vpnActive,
         @ethernetConnected, @openPortsJson, @listeningPortsJson)
    `);
  }

  return NextResponse.json({ ok: true });
}

import { getDb, sql } from "./db";
import { getMediaServiceUrl, getProfiles, getStreamUri, type OnvifProfile } from "./onvif";

export interface NvrDeviceRow {
  Id: number;
  Name: string;
  IpAddress: string;
  Port: number;
  RtspPort: number;
  Username: string;
  Password: string;
  RtspUsername: string | null;
  RtspPassword: string | null;
  OnvifPath: string;
  Status: string;
  LastSyncedAt: string | null;
  LastError: string | null;
  CreatedAt: string;
}

export function deviceServiceUrl(nvr: Pick<NvrDeviceRow, "IpAddress" | "Port" | "OnvifPath">): string {
  return `http://${nvr.IpAddress}:${nvr.Port}${nvr.OnvifPath}`;
}

// Some NVRs (confirmed live on a Dahua-OEM unit) authenticate RTSP against the main admin
// account rather than the dedicated ONVIF account used for the SOAP/snapshot side - falls
// back to the ONVIF credentials when no separate RTSP ones are configured.
export function rtspUrlFor(
  nvr: Pick<NvrDeviceRow, "IpAddress" | "RtspPort" | "Username" | "Password" | "RtspUsername" | "RtspPassword">,
  channelNumber: number,
  subtype: 0 | 1 = 0
): string {
  const user = encodeURIComponent(nvr.RtspUsername || nvr.Username);
  const pass = encodeURIComponent(nvr.RtspPassword || nvr.Password);
  return `rtsp://${user}:${pass}@${nvr.IpAddress}:${nvr.RtspPort}/cam/realmonitor?channel=${channelNumber}&subtype=${subtype}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// Dahua's proprietary recorded-playback RTSP endpoint (distinct from /cam/realmonitor used
// for live view) - same host/port/credential pattern as rtspUrlFor, confirmed this NVR
// accepts the connection (RTSP handshake succeeds) for this URL shape.
//
// IMPORTANT: the NVR indexes recordings by its own LOCAL clock, not UTC - it was confirmed
// live (wrong-day playback) that formatting these in UTC shifts the request across a
// midnight boundary whenever the offset between UTC and the NVR's local timezone pushes the
// requested time into the previous/next day. This server and the NVR are in the same
// physical office, so the Node process's own local time (Date's non-UTC getters) already
// matches the NVR's clock - deliberately NOT using getUTC*() here.
export function playbackRtspUrlFor(
  nvr: Pick<NvrDeviceRow, "IpAddress" | "RtspPort" | "Username" | "Password" | "RtspUsername" | "RtspPassword">,
  channelNumber: number,
  startTime: Date,
  endTime: Date,
  subtype: 0 | 1 = 0
): string {
  const user = encodeURIComponent(nvr.RtspUsername || nvr.Username);
  const pass = encodeURIComponent(nvr.RtspPassword || nvr.Password);
  const fmt = (d: Date) =>
    `${d.getFullYear()}_${pad2(d.getMonth() + 1)}_${pad2(d.getDate())}_${pad2(d.getHours())}_${pad2(d.getMinutes())}_${pad2(d.getSeconds())}`;
  return `rtsp://${user}:${pass}@${nvr.IpAddress}:${nvr.RtspPort}/cam/playback?channel=${channelNumber}&subtype=${subtype}&starttime=${fmt(startTime)}&endtime=${fmt(endTime)}`;
}

// Profile names look like "MediaProfile_Channel1_MainStream"  -  pulls out the "1".
function parseChannelNumber(profileName: string): number | null {
  const match = profileName.match(/channel\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

export async function getNvrById(id: number): Promise<NvrDeviceRow | null> {
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, id).query<NvrDeviceRow>("SELECT * FROM NvrDevices WHERE Id = @id");
  return result.recordset[0] ?? null;
}

// Many NVRs report 2-3 ONVIF profiles per physical channel (a full-res MainStream plus one
// or more lower-res SubStreams meant for bandwidth-constrained viewers/recording, not
// separate cameras)  -  storing every profile as its own "camera" row inflates a 16-channel
// NVR into 45+ grid tiles and triples the snapshot polling load for no benefit. Keep only
// the profile(s) that don't look like a substream; if that filter would remove everything
// (a device with a naming scheme this doesn't recognize), fall back to keeping them all
// rather than silently showing zero cameras.
function preferMainStreamProfiles(profiles: OnvifProfile[]): OnvifProfile[] {
  const mainOnly = profiles.filter((p) => !/sub\s*stream|substream/i.test(p.name));
  return mainOnly.length > 0 ? mainOnly : profiles;
}

// Connects to the NVR over ONVIF, enumerates its channels (profiles), fetches each
// channel's snapshot/stream URIs (best-effort  -  one channel's failure doesn't abort the
// rest), and upserts the result into NvrCameras. Also updates the NVR row's own
// Status/LastSyncedAt/LastError so the dashboard can show whether the last sync worked.
export async function syncNvrCameras(nvrId: number): Promise<{ ok: boolean; error?: string; cameraCount?: number }> {
  const db = await getDb();
  const nvr = await getNvrById(nvrId);
  if (!nvr) return { ok: false, error: "NVR not found" };

  try {
    const deviceUrl = deviceServiceUrl(nvr);
    const mediaUrl = await getMediaServiceUrl(deviceUrl, nvr.Username, nvr.Password);
    const allProfiles = await getProfiles(mediaUrl, nvr.Username, nvr.Password);

    if (allProfiles.length === 0) {
      throw new Error("NVR responded but reported no camera channels (GetProfiles returned empty).");
    }

    const profiles = preferMainStreamProfiles(allProfiles);

    for (const profile of profiles) {
      let streamUri: string | null = null;
      try {
        streamUri = await getStreamUri(mediaUrl, nvr.Username, nvr.Password, profile.token);
      } catch {
        // Best-effort - some channels/firmwares don't expose a stream URI via ONVIF; the
        // camera still shows up (live-view is built from ChannelNumber directly, see
        // rtspUrlFor - this stored value isn't actually used by that path today).
      }

      const channelNumber = parseChannelNumber(profile.name);

      await db
        .request()
        .input("nvrId", sql.Int, nvrId)
        .input("token", sql.NVarChar, profile.token)
        .input("name", sql.NVarChar, profile.name)
        .input("streamUri", sql.NVarChar, streamUri)
        .input("channelNumber", sql.Int, channelNumber)
        .query(`
          MERGE NvrCameras AS target
          USING (SELECT @nvrId AS NvrId, @token AS ProfileToken) AS src
          ON target.NvrId = src.NvrId AND target.ProfileToken = src.ProfileToken
          WHEN MATCHED THEN UPDATE SET ChannelName = @name, StreamUri = @streamUri, ChannelNumber = @channelNumber, Status = 'Online', LastSeenAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (NvrId, ProfileToken, ChannelName, StreamUri, ChannelNumber, Status, LastSeenAt)
            VALUES (@nvrId, @token, @name, @streamUri, @channelNumber, 'Online', SYSUTCDATETIME());
        `);
    }

    // Channels that disappeared from the NVR's own profile list (removed/renamed camera)
    // are dropped rather than left showing stale "Online" forever.
    const currentTokens = profiles.map((p) => p.token);
    if (currentTokens.length > 0) {
      const tokenList = currentTokens.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
      await db.request().input("nvrId", sql.Int, nvrId).query(`DELETE FROM NvrCameras WHERE NvrId = @nvrId AND ProfileToken NOT IN (${tokenList})`);
    }

    await db
      .request()
      .input("id", sql.Int, nvrId)
      .query("UPDATE NvrDevices SET Status = 'Online', LastSyncedAt = SYSUTCDATETIME(), LastError = NULL WHERE Id = @id");

    return { ok: true, cameraCount: profiles.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .request()
      .input("id", sql.Int, nvrId)
      .input("error", sql.NVarChar, message)
      .query("UPDATE NvrDevices SET Status = 'Error', LastError = @error WHERE Id = @id");
    return { ok: false, error: message };
  }
}

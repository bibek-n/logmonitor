import { getDb, sql } from "./db";
import { getMediaServiceUrl, getProfiles, getStreamUri, type OnvifProfile } from "./onvif";
import { probeVideoCodec } from "./videoCodecProbe";

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

    // Fetch each channel's ONVIF stream URI first (sequential — lightweight SOAP calls), then
    // probe reachability for all channels in parallel (each probe is capped at 3s, so running
    // them together keeps total sync time close to one probe's latency instead of the sum of
    // all of them for a large multi-channel NVR).
    const onvifChannelInfo = await Promise.all(
      profiles.map(async (profile) => {
        let streamUri: string | null = null;
        try {
          streamUri = await getStreamUri(mediaUrl, nvr.Username, nvr.Password, profile.token);
        } catch {
          // Best-effort - some channels/firmwares don't expose a stream URI via ONVIF; the
          // camera still shows up (live-view is built from ChannelNumber directly, see
          // rtspUrlFor - this stored value isn't actually used by that path today).
        }
        const channelNumber = parseChannelNumber(profile.name);
        return { profile, streamUri, channelNumber };
      })
    );

    // Some NVRs simply omit a channel from GetProfiles entirely rather than listing it with no
    // signal - confirmed live on a 16-channel unit that reports channels 1-5 and 7-16 but never
    // channel 6 at all, even though the RTSP endpoint for channel 6 itself works fine. Gap-fill
    // any channel number missing between 1 and the highest one ONVIF DID report, probing it
    // directly via the same predictable per-channel RTSP URL (rtspUrlFor only needs a channel
    // number, not an ONVIF profile) so a channel the recorder just doesn't advertise still shows
    // up in the grid with a real status instead of silently not existing.
    const reportedChannelNumbers = new Set(onvifChannelInfo.map((c) => c.channelNumber).filter((n): n is number => n !== null));
    const maxReportedChannel = reportedChannelNumbers.size > 0 ? Math.max(...reportedChannelNumbers) : 0;
    const gapChannelNumbers: number[] = [];
    for (let n = 1; n <= maxReportedChannel; n++) {
      if (!reportedChannelNumbers.has(n)) gapChannelNumbers.push(n);
    }
    const gapChannelInfo = gapChannelNumbers.map((channelNumber) => ({
      profile: { token: `gap-channel-${channelNumber}`, name: `Channel ${channelNumber}` },
      streamUri: null as string | null,
      channelNumber,
    }));

    const channelInfo = [...onvifChannelInfo, ...gapChannelInfo];

    // Browsers' WebRTC stacks can't decode H.265/HEVC - confirmed live that some channels on
    // a mixed-codec NVR are HEVC while others are H.264, which is exactly why live view/
    // playback silently fails for only some cameras. Detected via ffprobe (ONVIF doesn't
    // reliably expose this) so webrtc/route.ts and playback/route.ts know upfront which
    // channels need to go through the transcode relay instead of straight to MediaMTX.
    const videoCodecs = await Promise.all(
      channelInfo.map(({ channelNumber }) => (channelNumber === null ? Promise.resolve(null) : probeVideoCodec(rtspUrlFor(nvr, channelNumber))))
    );

    // Status is derived from whether ffprobe actually found decodable video, not just from a
    // bare RTSP DESCRIBE handshake succeeding - confirmed live that a channel with no physical
    // camera attached can still answer DESCRIBE (the NVR's RTSP service is up) while never
    // producing real video/audio, which made probeRtspStream alone report a misleading
    // "Online" for a channel with nothing actually connected to it.
    const statuses = channelInfo.map(({ channelNumber }, i) => {
      if (channelNumber === null) return "Unknown";
      return videoCodecs[i] === "h264" || videoCodecs[i] === "hevc" ? "Online" : "Offline";
    });

    for (let i = 0; i < channelInfo.length; i++) {
      const { profile, streamUri, channelNumber } = channelInfo[i];
      const status = statuses[i];
      const videoCodec = videoCodecs[i];

      await db
        .request()
        .input("nvrId", sql.Int, nvrId)
        .input("token", sql.NVarChar, profile.token)
        .input("name", sql.NVarChar, profile.name)
        .input("streamUri", sql.NVarChar, streamUri)
        .input("channelNumber", sql.Int, channelNumber)
        .input("status", sql.NVarChar, status)
        .input("videoCodec", sql.NVarChar, videoCodec)
        .query(`
          MERGE NvrCameras AS target
          USING (SELECT @nvrId AS NvrId, @token AS ProfileToken) AS src
          ON target.NvrId = src.NvrId AND target.ProfileToken = src.ProfileToken
          WHEN MATCHED THEN UPDATE SET ChannelName = @name, StreamUri = @streamUri, ChannelNumber = @channelNumber, Status = @status, VideoCodec = @videoCodec, LastSeenAt = SYSUTCDATETIME()
          WHEN NOT MATCHED THEN INSERT (NvrId, ProfileToken, ChannelName, StreamUri, ChannelNumber, Status, VideoCodec, LastSeenAt)
            VALUES (@nvrId, @token, @name, @streamUri, @channelNumber, @status, @videoCodec, SYSUTCDATETIME());
        `);
    }

    // Channels that disappeared from the NVR's own profile list (removed/renamed camera)
    // are dropped rather than left showing stale "Online" forever - gap-filled channel tokens
    // are included here too, or they'd be deleted as "stale" on the very next sync.
    const currentTokens = channelInfo.map(({ profile }) => profile.token);
    if (currentTokens.length > 0) {
      const tokenList = currentTokens.map((t) => `'${t.replace(/'/g, "''")}'`).join(",");
      await db.request().input("nvrId", sql.Int, nvrId).query(`DELETE FROM NvrCameras WHERE NvrId = @nvrId AND ProfileToken NOT IN (${tokenList})`);
    }

    await db
      .request()
      .input("id", sql.Int, nvrId)
      .query("UPDATE NvrDevices SET Status = 'Online', LastSyncedAt = SYSUTCDATETIME(), LastError = NULL WHERE Id = @id");

    return { ok: true, cameraCount: channelInfo.length };
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

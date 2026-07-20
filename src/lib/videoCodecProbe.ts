import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const FFPROBE_PATH = process.env.FFPROBE_PATH || "ffprobe";
const PROBE_TIMEOUT_MS = 8000;

export type DetectedVideoCodec = "h264" | "hevc" | "other" | null;

// Determines a channel's actual video codec by asking ffprobe to inspect its RTSP stream
// directly - ONVIF's GetProfiles response doesn't reliably expose this, and it matters
// because browsers' WebRTC stacks can't decode H.265/HEVC (confirmed live: 7 of 16 channels
// on this NVR are HEVC while the rest are H.264), so a channel needs to be flagged for
// transcoding (see transcodeRelay.ts) before a viewer ever hits "Failed to start stream".
// Returns null on timeout/error rather than throwing - a channel that's briefly unreachable
// during sync shouldn't block the rest of the sync, it just keeps whatever codec value (or
// null) it already had.
export async function probeVideoCodec(rtspUrl: string, timeoutMs = PROBE_TIMEOUT_MS): Promise<DetectedVideoCodec> {
  try {
    const { stdout } = await execFileAsync(
      FFPROBE_PATH,
      ["-v", "error", "-rtsp_transport", "tcp", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "json", "-timeout", String(timeoutMs * 1000), rtspUrl],
      { timeout: timeoutMs + 2000 }
    );
    const parsed = JSON.parse(stdout);
    const codecName: string | undefined = parsed?.streams?.[0]?.codec_name;
    if (!codecName) return null;
    if (codecName === "h264") return "h264";
    if (codecName === "hevc") return "hevc";
    return "other";
  } catch {
    return null;
  }
}

import "dotenv/config";
import { getDb } from "../src/lib/db";

// Detected per-channel via ffprobe during sync (see syncNvrCameras in src/lib/nvr.ts) -
// browsers' WebRTC stacks can't decode H.265/HEVC, so this tells the live-view/playback
// routes whether a channel needs to go through the H.265->H.264 transcode relay
// (src/lib/transcodeRelay.ts) instead of being proxied straight to MediaMTX.
async function main() {
  const db = await getDb();

  await db.query`
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('NvrCameras') AND name = 'VideoCodec')
    ALTER TABLE NvrCameras ADD VideoCodec NVARCHAR(20) NULL
  `;

  console.log("NvrCameras.VideoCodec column ready.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

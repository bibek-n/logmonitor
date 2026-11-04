import "dotenv/config";
import { getDb } from "../src/lib/db";

// Remote Access Phase 4: widens RemoteSessions.SessionType to accept 'Vnc', for the new
// in-browser VNC viewer (vncSessionService.ts). Everything else VNC needs - RemoteConnections,
// RemoteCredentials, the 'VNC' protocol value, the ra_vnc_start permission key - already existed
// from Phase 1; only this one CHECK constraint needed widening.
async function main() {
  const db = await getDb();

  await db.query`
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_RemoteSessions_SessionType')
    ALTER TABLE RemoteSessions DROP CONSTRAINT CK_RemoteSessions_SessionType
  `;
  await db.query`
    ALTER TABLE RemoteSessions ADD CONSTRAINT CK_RemoteSessions_SessionType CHECK (SessionType IN ('Terminal','Sftp','Vnc'))
  `;

  console.log("Remote Access Phase 4 schema ready (RemoteSessions.SessionType now accepts 'Vnc').");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

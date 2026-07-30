import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { WatchedFilesClient } from "@/components/fileIntegrity/WatchedFilesClient";

export const dynamic = "force-dynamic";

export default async function WatchedFilesPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Watched Files</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage watched files.</p>
      </div>
    );
  }

  const db = await getDb();
  const devicesResult = await db.query<{ DeviceId: string; DeviceName: string | null; Hostname: string }>(
    "SELECT DeviceId, DeviceName, Hostname FROM Devices ORDER BY DeviceName ASC, Hostname ASC"
  );

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Watched Files</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Choose which files to monitor for changes on each device - config files, credentials, anything worth knowing was
        edited. The device records the current content as a baseline the first time it checks a newly-added path, then
        reports every change after that.
      </p>
      <WatchedFilesClient devices={devicesResult.recordset} />
    </div>
  );
}

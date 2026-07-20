import { getDb } from "@/lib/db";
import { CamerasClient, type NvrDeviceSummary, type CameraSummary } from "@/components/cameras/CamerasClient";

export const dynamic = "force-dynamic";

export default async function CamerasPage() {
  const db = await getDb();

  const [devicesResult, camerasResult] = await Promise.all([
    db.query<NvrDeviceSummary>(`
      SELECT n.Id, n.Name, n.IpAddress, n.Port, n.Status, n.LastSyncedAt, n.LastError,
        (SELECT COUNT(*) FROM NvrCameras c WHERE c.NvrId = n.Id) AS CameraCount
      FROM NvrDevices n
      ORDER BY n.Name
    `),
    db.query<CameraSummary>(`
      SELECT c.Id, c.NvrId, n.Name AS NvrName, c.ChannelName, c.Status, c.LastSeenAt, c.Label, c.Location, c.SortOrder
      FROM NvrCameras c
      JOIN NvrDevices n ON n.Id = c.NvrId
      ORDER BY c.SortOrder, n.Name, c.ChannelName
    `),
  ]);

  return <CamerasClient initialDevices={devicesResult.recordset} initialCameras={camerasResult.recordset} />;
}

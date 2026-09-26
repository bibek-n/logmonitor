import { getSecurityUpdatesAccess } from "@/lib/requireSecurityUpdatesPermission";
import { SecurityUpdatesDevicesClient } from "@/components/securityUpdates/SecurityUpdatesDevicesClient";
import { getServerRoomAccess } from "@/lib/requireServerRoomPermission";

export const dynamic = "force-dynamic";

export default async function SecurityUpdatesDevicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { su, can } = await getSecurityUpdatesAccess();
  if (!su) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Security &amp; Updates</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }
  const { status } = await searchParams;
  const room = await getServerRoomAccess();

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Devices &amp; Scans</h1>
      <SecurityUpdatesDevicesClient canScan={!!can.su_scan} canInstall={!!can.su_install} canSchedule={!!can.su_schedule} canIncident={!!room.can.sr_incidents} initialStatus={status ?? ""} />
    </div>
  );
}

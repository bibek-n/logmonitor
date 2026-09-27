import { getWebAccessControlSession } from "@/lib/requireWebAccessControlPermission";
import { WacSchedulesClient } from "@/components/webAccessControl/SchedulesClient";

export const dynamic = "force-dynamic";

export default async function WebAccessControlSchedulesPage() {
  const wac = await getWebAccessControlSession("wac_view");
  if (!wac) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Schedules</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Web Access Control.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Schedules</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Time windows a website rule can be limited to (e.g. only block social media during Working Hours). Always,
        Working Hours, and Lunch Break are built in; add a Custom schedule for anything else. Times are evaluated
        using this server&apos;s local time.
      </p>
      <WacSchedulesClient />
    </div>
  );
}

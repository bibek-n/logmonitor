import { getBrowserActivityAccess } from "@/lib/requireBrowserActivityPermission";
import { EventsClient } from "@/components/browserActivity/EventsClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivityEventsPage() {
  const { browserActivity, can } = await getBrowserActivityAccess();
  if (!browserActivity) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Activity Events</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view browser activity events.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Activity Events</h1>
      <EventsClient canExport={can.ba_export} />
    </div>
  );
}

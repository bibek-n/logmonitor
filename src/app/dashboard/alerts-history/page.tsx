import { getAlertHistory } from "@/lib/alerts";
import { AlertHistoryClient } from "@/components/alerts/AlertHistoryClient";

export const dynamic = "force-dynamic";

export default async function AlertsHistoryPage() {
  const alerts = await getAlertHistory(30, 300);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Alert History</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.5rem" }}>
        Everything that has ever popped the notification bell — IP conflicts, device alerts, website performance
        issues, and off-hours logins — kept here so you can look back past what the bell dropdown currently shows.
      </p>
      <AlertHistoryClient initialAlerts={alerts} initialDays={30} />
    </div>
  );
}

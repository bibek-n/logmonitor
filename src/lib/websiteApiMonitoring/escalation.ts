import { getDb, sql } from "../db";
import { dispatchToContact, logNotificationAttempt, AlertContactRow } from "./notifications";

interface EscalationStepRow {
  StepId: number;
  DelayMinutes: number;
}

interface DueIncidentRow {
  IncidentId: number;
  MonitorId: number;
  MonitorName: string;
  StartedAt: string;
  AlertPolicyId: number;
}

// Escalation steps fire on top of (not instead of) the immediate notification already sent when
// the incident opened - each step's own contact list gets notified once, DelayMinutes after the
// incident's StartedAt. Only ever applies to still-Open, still-unacknowledged incidents - the
// moment someone acknowledges the incident (or it auto-resolves on recovery), no further steps
// fire for it. Safe to call every scan pass: IncidentEscalations records which (incident, step)
// pairs already fired so a step is never notified twice.
export async function processEscalations(): Promise<void> {
  const db = await getDb();

  const dueIncidents = await db.query<DueIncidentRow>(`
    SELECT i.Id AS IncidentId, i.MonitorId, m.Name AS MonitorName,
      CONVERT(VARCHAR(33), i.StartedAt, 126) AS StartedAt, ap.Id AS AlertPolicyId
    FROM Incidents i
    JOIN Monitors m ON m.Id = i.MonitorId
    JOIN AlertPolicies ap ON ap.Id = ISNULL(m.AlertPolicyId, (SELECT TOP 1 Id FROM AlertPolicies WHERE IsDefault = 1))
    WHERE i.Status = 'Open' AND i.AcknowledgedAt IS NULL AND ap.EscalationEnabled = 1
  `);

  for (const incident of dueIncidents.recordset) {
    const elapsedMinutes = Math.floor((Date.now() - new Date(incident.StartedAt).getTime()) / 60000);

    const steps = await db
      .request()
      .input("policyId", sql.Int, incident.AlertPolicyId)
      .query<EscalationStepRow>("SELECT Id AS StepId, DelayMinutes FROM AlertEscalationSteps WHERE AlertPolicyId = @policyId ORDER BY StepOrder ASC");

    for (const step of steps.recordset) {
      if (elapsedMinutes < step.DelayMinutes) continue;

      const already = await db
        .request()
        .input("incidentId", sql.Int, incident.IncidentId)
        .input("stepId", sql.Int, step.StepId)
        .query<{ IncidentId: number }>("SELECT IncidentId FROM IncidentEscalations WHERE IncidentId = @incidentId AND StepId = @stepId");
      if (already.recordset[0]) continue;

      const contacts = await db
        .request()
        .input("stepId", sql.Int, step.StepId)
        .query<AlertContactRow>(`
          SELECT ac.Id, ac.ContactType, ac.Destination, ac.ConfigJson
          FROM AlertEscalationStepContacts sc
          JOIN AlertContacts ac ON ac.Id = sc.AlertContactId
          WHERE sc.StepId = @stepId AND ac.IsActive = 1
        `);

      const subject = `[ESCALATED] ${incident.MonitorName} still down`;
      const body = `${incident.MonitorName} has been down and unacknowledged for ${elapsedMinutes} minute(s). Escalating to the next contact(s).`;

      for (const contact of contacts.recordset) {
        const result = await dispatchToContact(contact, { eventType: "Escalation", monitorId: incident.MonitorId, incidentId: incident.IncidentId, subject, body });
        await logNotificationAttempt({
          eventType: "Escalation",
          monitorId: incident.MonitorId,
          incidentId: incident.IncidentId,
          contactId: contact.Id,
          provider: contact.ContactType,
          subject,
          body,
          status: result.success ? "Sent" : "Failed",
          failureReason: result.error,
        });
      }

      // Recorded even when the step had zero contacts configured - the step "fired", it just
      // had nothing to notify; re-evaluating it every pass forever would be the actual bug.
      await db
        .request()
        .input("incidentId", sql.Int, incident.IncidentId)
        .input("stepId", sql.Int, step.StepId)
        .query("INSERT INTO IncidentEscalations (IncidentId, StepId) VALUES (@incidentId, @stepId)");
    }
  }
}

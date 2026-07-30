import { getDb, sql } from "../db";

// Shared by both the alert-policies create and update routes: (re)writes a policy's ordered
// escalation steps + each step's contact list from scratch. The caller is responsible for
// deleting any existing steps first on update (ON DELETE CASCADE from AlertEscalationSteps
// handles AlertEscalationStepContacts and IncidentEscalations automatically).
export async function insertEscalationSteps(policyId: number, steps: { delayMinutes: number; contactIds: number[] }[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < steps.length; i++) {
    const inserted = await db
      .request()
      .input("policyId", sql.Int, policyId)
      .input("stepOrder", sql.Int, i + 1)
      .input("delayMinutes", sql.Int, steps[i].delayMinutes)
      .query<{ Id: number }>("INSERT INTO AlertEscalationSteps (AlertPolicyId, StepOrder, DelayMinutes) OUTPUT INSERTED.Id VALUES (@policyId, @stepOrder, @delayMinutes)");
    const stepId = inserted.recordset[0].Id;
    for (const contactId of steps[i].contactIds) {
      await db.request().input("stepId", sql.Int, stepId).input("contactId", sql.Int, contactId).query("INSERT INTO AlertEscalationStepContacts (StepId, AlertContactId) VALUES (@stepId, @contactId)");
    }
  }
}

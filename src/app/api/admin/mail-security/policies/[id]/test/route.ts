import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";
import { testPolicySchema } from "@/lib/mailSecurity/schema";
import { loadPolicyById, loadActiveExceptions } from "@/lib/mailSecurity/repository";
import { inspectFile } from "@/lib/mailSecurity/fileInspection";
import { inspectUrl } from "@/lib/mailSecurity/urlInspection";
import { evaluateMessage, messageContextFromAddresses } from "@/lib/mailSecurity/policyEngine";
import { DEFAULT_URL_RULES, EvaluatedMessage } from "@/lib/mailSecurity/types";
import { renderTemplate, sendPolicyNotifications, summarizeNotificationOutcomes, TemplateVars } from "@/lib/mailSecurity/notifications";

// Tests ONE policy in isolation against a simulated message (no real mailbox is ever
// touched - Stage 1 has no live provider connected). Runs the real file/URL inspection and
// policy-evaluation engine, and writes a real MailSecurityIncidents row (Source='Simulation')
// so the Incidents/Reports pages stay meaningfully exercised even before Stage 2 wires up a
// live provider.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_view");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const policy = await loadPolicyById(Number(id));
  if (!policy) return NextResponse.json({ ok: false, error: "Policy not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = testPolicySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid test message" }, { status: 400 });
  }
  const input = parsed.data;

  const startedAt = Date.now();

  const attachments = [];
  for (const att of input.attachments) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(att.contentBase64, "base64");
    } catch {
      return NextResponse.json({ ok: false, error: `Attachment "${att.fileName}" is not valid base64 content` }, { status: 400 });
    }
    attachments.push(await inspectFile(att.fileName, buffer, policy.rules.archiveLimits));
  }

  const urlRules = policy.urlRules ?? DEFAULT_URL_RULES;
  const urls = [];
  for (const u of input.urls) {
    urls.push(await inspectUrl(u, urlRules));
  }

  const message: EvaluatedMessage = {
    direction: input.message.direction,
    sender: input.message.sender,
    recipients: input.message.recipients,
    subject: input.message.subject ?? null,
    attachments,
    urls,
  };

  const ctx = {
    ...messageContextFromAddresses(input.message.sender, input.message.recipients),
    departmentId: input.scopeContext?.departmentId ?? null,
    staffId: input.scopeContext?.staffId ?? null,
    providerConnectionId: input.scopeContext?.providerConnectionId ?? null,
    groupTag: input.scopeContext?.groupTag ?? null,
  };

  const allExceptions = await loadActiveExceptions();
  const scopedExceptions = allExceptions.filter((e) => e.policyId === null || e.policyId === policy.id);

  const decision = evaluateMessage(message, ctx, [policy], scopedExceptions);
  const processingTimeMs = Date.now() - startedAt;

  const db = await getDb();
  const incidentInsert = await db
    .request()
    .input("direction", sql.VarChar, message.direction)
    .input("sender", sql.NVarChar, message.sender)
    .input("recipients", sql.NVarChar, message.recipients.join(", "))
    .input("subject", sql.NVarChar, message.subject)
    .input("matchedPolicyId", sql.Int, decision.matchedPolicy?.id ?? null)
    .input("actionTaken", sql.VarChar, decision.action)
    .input("blockReason", sql.NVarChar, decision.reason)
    .input("exceptionUsedId", sql.Int, decision.exceptionUsed?.id ?? null)
    .input("processingTimeMs", sql.Int, processingTimeMs)
    .query<{ Id: number; IncidentId: string }>(`
      INSERT INTO MailSecurityIncidents (Source, Direction, Sender, Recipients, Subject, MatchedPolicyId, ActionTaken, BlockReason, ExceptionUsedId, ProcessingTimeMs)
      OUTPUT INSERTED.Id, INSERTED.IncidentId
      VALUES ('Simulation', @direction, @sender, @recipients, @subject, @matchedPolicyId, @actionTaken, @blockReason, @exceptionUsedId, @processingTimeMs)
    `);
  const incidentRow = incidentInsert.recordset[0];

  for (const att of attachments) {
    await db
      .request()
      .input("incidentId", sql.Int, incidentRow.Id)
      .input("fileName", sql.NVarChar, att.fileName)
      .input("declaredExtension", sql.NVarChar, att.declaredExtension)
      .input("detectedFileType", sql.NVarChar, att.detectedFileType)
      .input("mimeType", sql.NVarChar, att.detectedMimeType)
      .input("fileHash", sql.Char(64), att.hash)
      .input("fileSizeBytes", sql.BigInt, att.sizeBytes)
      .input("inspectionResultJson", sql.NVarChar(sql.MAX), JSON.stringify({ characteristics: att.characteristics, archiveFindings: att.archiveFindings ?? null }))
      .input("blocked", sql.Bit, decision.blockedAttachments.includes(att.fileName))
      .query(`
        INSERT INTO MailIncidentAttachments (IncidentId, FileName, DeclaredExtension, DetectedFileType, MimeType, FileHash, FileSizeBytes, InspectionResultJson, Blocked)
        VALUES (@incidentId, @fileName, @declaredExtension, @detectedFileType, @mimeType, @fileHash, @fileSizeBytes, @inspectionResultJson, @blocked)
      `);
  }

  for (const u of urls) {
    await db
      .request()
      .input("incidentId", sql.Int, incidentRow.Id)
      .input("originalUrl", sql.NVarChar, u.originalUrl)
      .input("resolvedUrl", sql.NVarChar, u.resolvedUrl)
      .input("domain", sql.NVarChar, u.domain)
      .input("cloudProvider", sql.NVarChar, u.cloudProvider)
      .input("blocked", sql.Bit, decision.blockedUrls.includes(u.originalUrl))
      .input("reason", sql.NVarChar, u.blockedReason)
      .query(`
        INSERT INTO MailIncidentUrls (IncidentId, OriginalUrl, ResolvedUrl, Domain, CloudProvider, Blocked, Reason)
        VALUES (@incidentId, @originalUrl, @resolvedUrl, @domain, @cloudProvider, @blocked, @reason)
      `);
  }

  let notificationSummary = "Not sent (dry run - pass sendTestNotifications:true to actually email test recipients)";
  let renderedPreview: { subject: string; body: string } | null = null;

  if (decision.action !== "Allow") {
    const templateResult = await db
      .request()
      .input("eventType", sql.VarChar, "AdminAlert")
      .query<{ Subject: string; Body: string }>("SELECT Subject, Body FROM MailNotificationTemplates WHERE EventType = @eventType");
    const template = templateResult.recordset[0];

    if (template) {
      const vars: TemplateVars = {
        sender: message.sender,
        recipient: message.recipients.join(", "),
        subject: message.subject ?? "(no subject)",
        file_name: attachments[0]?.fileName ?? urls[0]?.originalUrl ?? "(none)",
        detected_type: attachments[0]?.detectedFileType ?? "N/A",
        policy_name: policy.name,
        block_reason: decision.reason,
        incident_id: incidentRow.IncidentId,
        timestamp: new Date().toISOString(),
        support_email: "support@websearchpro.net",
      };
      renderedPreview = { subject: renderTemplate(template.Subject, vars), body: renderTemplate(template.Body, vars) };

      if (input.sendTestNotifications) {
        const recipients = [];
        if (policy.notifySender) recipients.push({ to: message.sender, role: "sender" as const });
        if (policy.notifyRecipient) recipients.push(...message.recipients.map((r) => ({ to: r, role: "recipient" as const })));
        if (policy.notifyAdminEmail) recipients.push({ to: policy.notifyAdminEmail, role: "admin" as const });

        const outcomes = await sendPolicyNotifications(template.Subject, template.Body, vars, recipients);
        notificationSummary = summarizeNotificationOutcomes(outcomes);
        await db
          .request()
          .input("incidentId", sql.Int, incidentRow.Id)
          .input("status", sql.NVarChar, notificationSummary)
          .query("UPDATE MailSecurityIncidents SET NotificationStatus = @status WHERE Id = @incidentId");
      }
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      incidentId: incidentRow.IncidentId,
      decision,
      attachments,
      urls,
      notificationSummary,
      renderedNotificationPreview: renderedPreview,
    },
  });
}

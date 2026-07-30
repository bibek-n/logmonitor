import {
  ACTION_PRECEDENCE,
  EvaluatedMessage,
  FileInspectionResult,
  MailAction,
  MailPolicy,
  MailPolicyException,
  MailPolicyScope,
  PolicyDecision,
  UrlInspectionResult,
  actionRank,
  strongerAction,
} from "./types";

export interface ScopeContext {
  senderDomain: string;
  recipientDomains: string[];
  departmentId?: number | null;
  staffId?: number | null;
  providerConnectionId?: number | null;
  // Free-text group tag - this app has no first-class "Group" entity today (only
  // Departments/Staff/Users), so Group-scoped policies match against whatever tag the caller
  // supplies rather than a real membership table. Documented limitation, not a placeholder bug.
  groupTag?: string | null;
}

function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? email.toLowerCase() : email.slice(at + 1).toLowerCase();
}

function scopeMatches(scope: MailPolicyScope, ctx: ScopeContext): boolean {
  switch (scope.scopeType) {
    case "Global":
      return true;
    case "Domain":
      return (
        scope.scopeValue !== null &&
        (ctx.senderDomain === scope.scopeValue.toLowerCase() || ctx.recipientDomains.includes(scope.scopeValue.toLowerCase()))
      );
    case "Department":
      return scope.scopeValue !== null && ctx.departmentId !== undefined && ctx.departmentId !== null && String(ctx.departmentId) === scope.scopeValue;
    case "User":
      return scope.scopeValue !== null && ctx.staffId !== undefined && ctx.staffId !== null && String(ctx.staffId) === scope.scopeValue;
    case "Provider":
      return (
        scope.scopeValue !== null &&
        ctx.providerConnectionId !== undefined &&
        ctx.providerConnectionId !== null &&
        String(ctx.providerConnectionId) === scope.scopeValue
      );
    case "Group":
      return scope.scopeValue !== null && !!ctx.groupTag && ctx.groupTag === scope.scopeValue;
    default:
      return false;
  }
}

function isExceptionActive(exception: MailPolicyException, now: number): boolean {
  if (exception.revokedAt) return false;
  if (exception.expiresAt && new Date(exception.expiresAt).getTime() <= now) return false;
  return true;
}

function findAttachmentException(
  attachment: FileInspectionResult,
  ctx: ScopeContext,
  exceptions: MailPolicyException[],
  policyId: number,
  now: number
): MailPolicyException | null {
  for (const exc of exceptions) {
    if (exc.policyId !== null && exc.policyId !== policyId) continue;
    if (!isExceptionActive(exc, now)) continue;
    const value = exc.exceptionValue.toLowerCase();
    if (exc.exceptionType === "ApprovedExtension" && attachment.declaredExtension === value) return exc;
    if (exc.exceptionType === "ApprovedMimeType" && attachment.detectedMimeType === value) return exc;
    if (exc.exceptionType === "ApprovedHash" && attachment.hash === value) return exc;
    if (exc.exceptionType === "TrustedSender" && ctx.senderDomain === value) return exc;
    if (exc.exceptionType === "ApprovedDomain" && (ctx.senderDomain === value || ctx.recipientDomains.includes(value))) return exc;
  }
  return null;
}

function findUrlException(
  url: UrlInspectionResult,
  exceptions: MailPolicyException[],
  policyId: number,
  now: number
): MailPolicyException | null {
  for (const exc of exceptions) {
    if (exc.policyId !== null && exc.policyId !== policyId) continue;
    if (!isExceptionActive(exc, now)) continue;
    const value = exc.exceptionValue.toLowerCase();
    if (exc.exceptionType === "ApprovedUrl" && (url.originalUrl.toLowerCase() === value || url.resolvedUrl?.toLowerCase() === value)) return exc;
    if (exc.exceptionType === "ApprovedCloudDomain" && url.domain?.toLowerCase() === value) return exc;
  }
  return null;
}

function matchAttachmentAgainstPolicy(attachment: FileInspectionResult, policy: MailPolicy): { matched: boolean; action: MailAction; reason: string } {
  const limits = policy.rules.archiveLimits;

  if (attachment.uninspectableReason) {
    if (attachment.characteristics.passwordProtected) {
      return { matched: true, action: limits.onPasswordProtected, reason: `Password-protected: ${attachment.uninspectableReason}` };
    }
    if (attachment.characteristics.corrupted) {
      return { matched: true, action: limits.onCorrupted, reason: `Corrupted: ${attachment.uninspectableReason}` };
    }
    return { matched: true, action: limits.onUninspectable, reason: attachment.uninspectableReason };
  }

  if (attachment.declaredExtension && policy.rules.extensions.includes(attachment.declaredExtension)) {
    return { matched: true, action: policy.action, reason: `Extension .${attachment.declaredExtension} is blocked by policy "${policy.name}"` };
  }
  if (attachment.detectedMimeType && policy.rules.mimeTypes.includes(attachment.detectedMimeType)) {
    return { matched: true, action: policy.action, reason: `MIME type ${attachment.detectedMimeType} is blocked by policy "${policy.name}"` };
  }
  if (attachment.extensionMismatch && policy.rules.characteristics.executableContent) {
    return { matched: true, action: policy.action, reason: `File extension does not match detected content type (${attachment.detectedFileType ?? "unknown"})` };
  }

  for (const [key, wanted] of Object.entries(policy.rules.characteristics)) {
    if (!wanted) continue;
    if (attachment.characteristics[key as keyof typeof attachment.characteristics]) {
      return { matched: true, action: policy.action, reason: `Characteristic "${key}" matched policy "${policy.name}"` };
    }
  }

  return { matched: false, action: "Allow", reason: "" };
}

function matchUrlAgainstPolicy(url: UrlInspectionResult, policy: MailPolicy): { matched: boolean; action: MailAction; reason: string } {
  const rules = policy.urlRules;
  if (!rules) return { matched: false, action: "Allow", reason: "" };

  if (url.domain && rules.allowlist.some((d) => url.domain === d || url.domain?.endsWith(`.${d}`))) {
    return { matched: false, action: "Allow", reason: "" };
  }
  if (url.ssrfBlocked) {
    return { matched: true, action: policy.action, reason: "Redirect target could not be safely resolved (internal/private address)" };
  }
  if (rules.blockAllCloudLinks && url.cloudProvider) {
    return { matched: true, action: policy.action, reason: `All cloud-file links are blocked by policy "${policy.name}"` };
  }
  if (url.cloudProvider && rules.blockedProviders.includes(url.cloudProvider)) {
    return { matched: true, action: policy.action, reason: `${url.cloudProvider} links are blocked by policy "${policy.name}"` };
  }
  // Stage 1 has no live provider API access to check a link's actual sharing/download
  // settings - blockPublicSharing/blockDownloadable are applied as a coarse heuristic against
  // any detected cloud-provider link, not a precise per-link check.
  if ((rules.blockPublicSharing || rules.blockDownloadable) && url.cloudProvider) {
    return { matched: true, action: policy.action, reason: `Cloud-file link (${url.cloudProvider}) blocked under public-sharing/downloadable rule` };
  }
  for (const pattern of rules.urlPatterns) {
    try {
      if (new RegExp(pattern, "i").test(url.resolvedUrl ?? url.originalUrl)) {
        return { matched: true, action: policy.action, reason: `URL matched custom pattern "${pattern}"` };
      }
    } catch {
      // Invalid regex saved by an admin - skip rather than throw, this is validated on save
      // but a defensive skip here costs nothing.
    }
  }
  if (url.isShortenedLink) {
    return { matched: true, action: "Warn", reason: "Shortened link - destination could not be fully verified" };
  }
  return { matched: false, action: "Allow", reason: "" };
}

// The deterministic policy-evaluation engine described in the spec's section 10: scope, then
// mandatory-first/priority order, then rule match, then exceptions (never overriding a
// mandatory policy), then pick the strongest action across every match by the precedence
// table Reject > Block > Quarantine > RemoveAttachment > Warn > Allow. Pure function - no
// DB/IO - so it's fully unit-testable without a database or a live mail provider.
export function evaluateMessage(
  msg: EvaluatedMessage,
  ctx: ScopeContext,
  policies: MailPolicy[],
  exceptions: MailPolicyException[]
): PolicyDecision {
  const now = Date.now();
  const applicable = policies
    .filter((p) => p.enabled)
    .filter((p) => p.direction === "Both" || p.direction === msg.direction)
    .filter((p) => p.scopes.length === 0 || p.scopes.some((s) => scopeMatches(s, ctx)))
    .sort((a, b) => (a.mandatory === b.mandatory ? a.priority - b.priority : a.mandatory ? -1 : 1));

  let best: PolicyDecision = {
    action: "Allow",
    matchedPolicy: null,
    reason: "No policy matched",
    exceptionUsed: null,
    blockedAttachments: [],
    blockedUrls: [],
  };
  const blockedAttachments = new Set<string>();
  const blockedUrls = new Set<string>();

  for (const policy of applicable) {
    for (const attachment of msg.attachments) {
      const match = matchAttachmentAgainstPolicy(attachment, policy);
      if (!match.matched) continue;

      let action = match.action;
      let exceptionUsed: MailPolicyException | null = null;
      if (!policy.mandatory) {
        const exc = findAttachmentException(attachment, ctx, exceptions, policy.id, now);
        if (exc) {
          action = "Allow";
          exceptionUsed = exc;
        }
      }

      if (actionRank(action) < 4) blockedAttachments.add(attachment.fileName); // stronger than Warn/Allow

      if (actionRank(action) < actionRank(best.action) || best.matchedPolicy === null) {
        best = { action: strongerAction(action, best.action), matchedPolicy: policy, reason: match.reason, exceptionUsed, blockedAttachments: [], blockedUrls: [] };
      } else {
        best.action = strongerAction(action, best.action);
      }
    }

    for (const url of msg.urls) {
      const match = matchUrlAgainstPolicy(url, policy);
      if (!match.matched) continue;

      let action = match.action;
      let exceptionUsed: MailPolicyException | null = null;
      if (!policy.mandatory) {
        const exc = findUrlException(url, exceptions, policy.id, now);
        if (exc) {
          action = "Allow";
          exceptionUsed = exc;
        }
      }

      if (actionRank(action) < 4) blockedUrls.add(url.originalUrl);

      if (actionRank(action) < actionRank(best.action) || best.matchedPolicy === null) {
        best = { action: strongerAction(action, best.action), matchedPolicy: policy, reason: match.reason, exceptionUsed, blockedAttachments: [], blockedUrls: [] };
      } else {
        best.action = strongerAction(action, best.action);
      }
    }
  }

  best.blockedAttachments = Array.from(blockedAttachments);
  best.blockedUrls = Array.from(blockedUrls);
  return best;
}

export function messageContextFromAddresses(sender: string, recipients: string[]): Pick<ScopeContext, "senderDomain" | "recipientDomains"> {
  return { senderDomain: domainOf(sender), recipientDomains: recipients.map(domainOf) };
}

export { ACTION_PRECEDENCE };

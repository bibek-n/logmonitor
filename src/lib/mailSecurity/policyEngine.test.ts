import { describe, it, expect } from "vitest";
import { evaluateMessage, messageContextFromAddresses, ScopeContext } from "./policyEngine";
import { EvaluatedMessage, FileInspectionResult, MailPolicy, MailPolicyException, UrlInspectionResult } from "./types";
import { DEFAULT_ARCHIVE_LIMITS } from "./types";

function makeAttachment(overrides: Partial<FileInspectionResult> = {}): FileInspectionResult {
  return {
    fileName: "file.exe",
    declaredExtension: "exe",
    detectedMimeType: null,
    detectedFileType: null,
    sizeBytes: 100,
    hash: "abc123",
    characteristics: {
      passwordProtected: false,
      corrupted: false,
      doubleExtension: false,
      hiddenExtension: false,
      noExtension: false,
      embeddedFiles: false,
      macroEnabled: false,
      executableContent: true,
    },
    extensionMismatch: false,
    uninspectableReason: null,
    ...overrides,
  };
}

function makePolicy(overrides: Partial<MailPolicy> = {}): MailPolicy {
  return {
    id: 1,
    name: "Test Policy",
    description: null,
    enabled: true,
    mandatory: false,
    direction: "Both",
    priority: 100,
    action: "Block",
    rules: { extensions: ["exe"], mimeTypes: [], characteristics: {}, archiveLimits: DEFAULT_ARCHIVE_LIMITS },
    urlRules: null,
    notifySender: true,
    notifyRecipient: true,
    notifyAdminEmail: null,
    scopes: [{ scopeType: "Global", scopeValue: null }],
    ...overrides,
  };
}

function makeMessage(overrides: Partial<EvaluatedMessage> = {}): EvaluatedMessage {
  return {
    direction: "Incoming",
    sender: "alice@external.com",
    recipients: ["bob@company.com"],
    subject: "test",
    attachments: [],
    urls: [],
    ...overrides,
  };
}

const ctx: ScopeContext = { senderDomain: "external.com", recipientDomains: ["company.com"] };

describe("evaluateMessage", () => {
  it("blocks a message whose attachment extension matches a policy rule", () => {
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [makePolicy()], []);
    expect(decision.action).toBe("Block");
    expect(decision.blockedAttachments).toContain("file.exe");
  });

  it("allows a message with no matching attachments or urls", () => {
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment({ declaredExtension: "txt" })] }), ctx, [makePolicy()], []);
    expect(decision.action).toBe("Allow");
  });

  it("does not apply an Incoming-only policy to an Outgoing message", () => {
    const policy = makePolicy({ direction: "Incoming" });
    const decision = evaluateMessage(makeMessage({ direction: "Outgoing", attachments: [makeAttachment()] }), ctx, [policy], []);
    expect(decision.action).toBe("Allow");
  });

  it("lets a non-mandatory policy's block be overridden by a matching, active exception", () => {
    const policy = makePolicy({ mandatory: false });
    const exception: MailPolicyException = {
      id: 1,
      policyId: null,
      exceptionType: "ApprovedExtension",
      exceptionValue: "exe",
      reason: "vendor tool, approved by IT",
      approvedByUserId: 1,
      expiresAt: null,
      revokedAt: null,
    };
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [policy], [exception]);
    expect(decision.action).toBe("Allow");
    expect(decision.exceptionUsed?.id).toBe(1);
  });

  it("never lets an exception override a Mandatory policy", () => {
    const policy = makePolicy({ mandatory: true });
    const exception: MailPolicyException = {
      id: 1,
      policyId: null,
      exceptionType: "ApprovedExtension",
      exceptionValue: "exe",
      reason: "attempted bypass",
      approvedByUserId: 1,
      expiresAt: null,
      revokedAt: null,
    };
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [policy], [exception]);
    expect(decision.action).toBe("Block");
    expect(decision.exceptionUsed).toBeNull();
  });

  it("ignores an expired exception", () => {
    const policy = makePolicy({ mandatory: false });
    const exception: MailPolicyException = {
      id: 1,
      policyId: null,
      exceptionType: "ApprovedExtension",
      exceptionValue: "exe",
      reason: "temporary, now expired",
      approvedByUserId: 1,
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
      revokedAt: null,
    };
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [policy], [exception]);
    expect(decision.action).toBe("Block");
  });

  it("picks the strongest action across multiple matching policies (Reject beats Block)", () => {
    const blockPolicy = makePolicy({ id: 1, action: "Block", priority: 10 });
    const rejectPolicy = makePolicy({ id: 2, action: "Reject", priority: 20, rules: { ...blockPolicy.rules } });
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [blockPolicy, rejectPolicy], []);
    expect(decision.action).toBe("Reject");
  });

  it("evaluates mandatory policies before non-mandatory ones regardless of priority number", () => {
    const nonMandatory = makePolicy({ id: 1, action: "Warn", priority: 1, mandatory: false });
    const mandatory = makePolicy({ id: 2, action: "Block", priority: 999, mandatory: true });
    const decision = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [nonMandatory, mandatory], []);
    expect(decision.action).toBe("Block");
    expect(decision.matchedPolicy?.id).toBe(2);
  });

  it("matches a Domain-scoped policy against the sender/recipient domain and skips it otherwise", () => {
    const matchingScope = makePolicy({ scopes: [{ scopeType: "Domain", scopeValue: "external.com" }] });
    const nonMatchingScope = makePolicy({ scopes: [{ scopeType: "Domain", scopeValue: "someone-else.com" }] });

    const matched = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [matchingScope], []);
    expect(matched.action).toBe("Block");

    const unmatched = evaluateMessage(makeMessage({ attachments: [makeAttachment()] }), ctx, [nonMatchingScope], []);
    expect(unmatched.action).toBe("Allow");
  });

  it("blocks a cloud-file link when blockAllCloudLinks is set", () => {
    const policy = makePolicy({
      rules: { extensions: [], mimeTypes: [], characteristics: {}, archiveLimits: DEFAULT_ARCHIVE_LIMITS },
      urlRules: { blockAllCloudLinks: true, blockedProviders: [], blockPublicSharing: false, blockDownloadable: false, urlPatterns: [], allowlist: [] },
    });
    const url: UrlInspectionResult = {
      originalUrl: "https://drive.google.com/file/d/abc",
      resolvedUrl: "https://drive.google.com/file/d/abc",
      domain: "drive.google.com",
      cloudProvider: "Google Drive",
      isShortenedLink: false,
      isLookalikeDomain: false,
      blockedReason: null,
      ssrfBlocked: false,
    };
    const decision = evaluateMessage(makeMessage({ urls: [url] }), ctx, [policy], []);
    expect(decision.action).toBe("Block");
    expect(decision.blockedUrls).toContain(url.originalUrl);
  });

  it("derives sender/recipient domains from raw addresses", () => {
    expect(messageContextFromAddresses("a@Example.COM", ["b@Other.com"])).toEqual({
      senderDomain: "example.com",
      recipientDomains: ["other.com"],
    });
  });
});

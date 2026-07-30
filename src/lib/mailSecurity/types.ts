export type MailDirection = "Incoming" | "Outgoing" | "Both";
export type MailAction = "Reject" | "Block" | "Quarantine" | "RemoveAttachment" | "Warn" | "Allow";
export type UninspectableAction = "Block" | "Quarantine" | "Allow";
export type ScopeType = "Global" | "Domain" | "Department" | "Group" | "User" | "Provider";
export type ExceptionType =
  | "TrustedSender"
  | "TrustedRecipient"
  | "ApprovedDomain"
  | "ApprovedExtension"
  | "ApprovedMimeType"
  | "ApprovedHash"
  | "ApprovedCloudDomain"
  | "ApprovedUrl";
export type ProviderType = "M365" | "GoogleWorkspace" | "ExchangeServer" | "SmtpImap" | "Generic";
export type IncidentSource = "Simulation" | "Live";

// Action strength, highest first - used both to pick the strongest match across several
// policies and to guarantee a Mandatory policy's action can never be downgraded by a later,
// weaker match (including one coming from an exception).
export const ACTION_PRECEDENCE: MailAction[] = ["Reject", "Block", "Quarantine", "RemoveAttachment", "Warn", "Allow"];

export function actionRank(action: MailAction): number {
  const idx = ACTION_PRECEDENCE.indexOf(action);
  return idx === -1 ? ACTION_PRECEDENCE.length : idx;
}

export function strongerAction(a: MailAction, b: MailAction): MailAction {
  return actionRank(a) <= actionRank(b) ? a : b;
}

export interface ArchiveLimits {
  maxDepth: number;
  maxExtractedFiles: number;
  maxExtractedSizeBytes: number;
  maxCompressionRatio: number;
  timeoutMs: number;
  onPasswordProtected: UninspectableAction;
  onCorrupted: UninspectableAction;
  onUninspectable: UninspectableAction;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxDepth: 5,
  maxExtractedFiles: 2000,
  maxExtractedSizeBytes: 500 * 1024 * 1024,
  maxCompressionRatio: 100,
  timeoutMs: 15_000,
  onPasswordProtected: "Block",
  onCorrupted: "Block",
  onUninspectable: "Block",
};

export interface FileCharacteristics {
  passwordProtected: boolean;
  corrupted: boolean;
  doubleExtension: boolean;
  hiddenExtension: boolean;
  noExtension: boolean;
  embeddedFiles: boolean;
  macroEnabled: boolean;
  executableContent: boolean;
}

export interface PolicyRules {
  extensions: string[];
  mimeTypes: string[];
  characteristics: Partial<Record<keyof FileCharacteristics, boolean>>;
  archiveLimits: ArchiveLimits;
}

export interface UrlRules {
  blockAllCloudLinks: boolean;
  blockedProviders: string[];
  blockPublicSharing: boolean;
  blockDownloadable: boolean;
  urlPatterns: string[];
  allowlist: string[];
}

export const DEFAULT_POLICY_RULES: PolicyRules = {
  extensions: [],
  mimeTypes: [],
  characteristics: {},
  archiveLimits: DEFAULT_ARCHIVE_LIMITS,
};

export const DEFAULT_URL_RULES: UrlRules = {
  blockAllCloudLinks: false,
  blockedProviders: [],
  blockPublicSharing: false,
  blockDownloadable: false,
  urlPatterns: [],
  allowlist: [],
};

export interface MailPolicyScope {
  id?: number;
  scopeType: ScopeType;
  scopeValue: string | null;
}

export interface MailPolicy {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  mandatory: boolean;
  direction: MailDirection;
  priority: number;
  action: MailAction;
  rules: PolicyRules;
  urlRules: UrlRules | null;
  notifySender: boolean;
  notifyRecipient: boolean;
  notifyAdminEmail: string | null;
  scopes: MailPolicyScope[];
}

export interface MailPolicyException {
  id: number;
  policyId: number | null;
  exceptionType: ExceptionType;
  exceptionValue: string;
  reason: string;
  approvedByUserId: number;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface FileInspectionResult {
  fileName: string;
  declaredExtension: string | null;
  detectedMimeType: string | null;
  detectedFileType: string | null;
  sizeBytes: number;
  hash: string;
  characteristics: FileCharacteristics;
  extensionMismatch: boolean;
  uninspectableReason: string | null;
  archiveFindings?: ArchiveFindings;
}

export interface ArchiveFindings {
  totalEntries: number;
  maxDepthSeen: number;
  totalExtractedBytes: number;
  worstCompressionRatio: number;
  passwordProtected: boolean;
  corrupted: boolean;
  truncatedForSafety: boolean;
  truncationReason: string | null;
  nestedExecutables: string[];
}

export interface UrlInspectionResult {
  originalUrl: string;
  resolvedUrl: string | null;
  domain: string | null;
  cloudProvider: string | null;
  isShortenedLink: boolean;
  isLookalikeDomain: boolean;
  blockedReason: string | null;
  ssrfBlocked: boolean;
}

export interface EvaluatedMessage {
  direction: "Incoming" | "Outgoing";
  sender: string;
  recipients: string[];
  subject: string | null;
  attachments: FileInspectionResult[];
  urls: UrlInspectionResult[];
}

export interface PolicyMatch {
  policy: MailPolicy;
  action: MailAction;
  reason: string;
  exceptionUsed: MailPolicyException | null;
}

export interface PolicyDecision {
  action: MailAction;
  matchedPolicy: MailPolicy | null;
  reason: string;
  exceptionUsed: MailPolicyException | null;
  blockedAttachments: string[];
  blockedUrls: string[];
}

import { z } from "zod";

// Zod validation for the Mail Protection module's admin-facing payloads - the app-level gate
// enforced on every mail-security API route, independent of the DB's CHECK(ISJSON(...))
// constraint on RulesJson (which only proves "valid JSON", not "valid rule set").

const characteristicsSchema = z
  .object({
    passwordProtected: z.boolean().optional(),
    corrupted: z.boolean().optional(),
    doubleExtension: z.boolean().optional(),
    hiddenExtension: z.boolean().optional(),
    noExtension: z.boolean().optional(),
    embeddedFiles: z.boolean().optional(),
    macroEnabled: z.boolean().optional(),
    executableContent: z.boolean().optional(),
  })
  .default({});

const archiveLimitsSchema = z.object({
  maxDepth: z.number().int().min(1).max(20).default(5),
  maxExtractedFiles: z.number().int().min(1).max(100_000).default(2000),
  maxExtractedSizeBytes: z.number().int().min(1024).max(10 * 1024 * 1024 * 1024).default(500 * 1024 * 1024),
  maxCompressionRatio: z.number().min(1).max(10_000).default(100),
  timeoutMs: z.number().int().min(100).max(120_000).default(15_000),
  onPasswordProtected: z.enum(["Block", "Quarantine", "Allow"]).default("Block"),
  onCorrupted: z.enum(["Block", "Quarantine", "Allow"]).default("Block"),
  onUninspectable: z.enum(["Block", "Quarantine", "Allow"]).default("Block"),
});

const extensionField = z.string().trim().min(1).max(20).transform((v) => v.replace(/^\./, "").toLowerCase());

export const policyRulesSchema = z.object({
  extensions: z.array(extensionField).max(200).default([]),
  mimeTypes: z.array(z.string().trim().min(1).max(150)).max(200).default([]),
  characteristics: characteristicsSchema,
  archiveLimits: archiveLimitsSchema,
});

export const urlRulesSchema = z.object({
  blockAllCloudLinks: z.boolean().default(false),
  blockedProviders: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  blockPublicSharing: z.boolean().default(false),
  blockDownloadable: z.boolean().default(false),
  urlPatterns: z
    .array(
      z.string().trim().min(1).max(300).refine(
        (pattern) => {
          try {
            new RegExp(pattern);
            return true;
          } catch {
            return false;
          }
        },
        { message: "Must be a valid regular expression" }
      )
    )
    .max(100)
    .default([]),
  allowlist: z.array(z.string().trim().min(1).max(300)).max(200).default([]),
});

export const policyScopeSchema = z.object({
  scopeType: z.enum(["Global", "Domain", "Department", "Group", "User", "Provider"]),
  scopeValue: z.string().trim().max(300).nullable().optional(),
});

export const createPolicySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  enabled: z.boolean().default(true),
  mandatory: z.boolean().default(false),
  direction: z.enum(["Incoming", "Outgoing", "Both"]).default("Both"),
  priority: z.number().int().min(1).max(100_000).default(100),
  action: z.enum(["Reject", "Block", "Quarantine", "RemoveAttachment", "Warn", "Allow"]),
  rules: policyRulesSchema,
  urlRules: urlRulesSchema.optional().nullable(),
  notifySender: z.boolean().default(true),
  notifyRecipient: z.boolean().default(true),
  notifyAdminEmail: z.string().trim().email().max(320).optional().nullable(),
  scopes: z.array(policyScopeSchema).min(1).max(50).default([{ scopeType: "Global", scopeValue: null }]),
});

export const updatePolicySchema = createPolicySchema.partial().extend({
  scopes: z.array(policyScopeSchema).min(1).max(50).optional(),
});

export const createExceptionSchema = z.object({
  policyId: z.number().int().positive().optional().nullable(),
  exceptionType: z.enum([
    "TrustedSender",
    "TrustedRecipient",
    "ApprovedDomain",
    "ApprovedExtension",
    "ApprovedMimeType",
    "ApprovedHash",
    "ApprovedCloudDomain",
    "ApprovedUrl",
  ]),
  exceptionValue: z.string().trim().min(1).max(500),
  reason: z.string().trim().min(1).max(500),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const updateTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
});

export const createProviderConnectionSchema = z.object({
  providerType: z.enum(["M365", "GoogleWorkspace", "ExchangeServer", "SmtpImap", "Generic"]),
  displayName: z.string().trim().min(1).max(200),
  config: z.record(z.string(), z.string().max(500)).default({}),
  secret: z.string().max(2000).optional().nullable(),
});

export const updateProviderConnectionSchema = createProviderConnectionSchema.partial();

const attachmentInputSchema = z.object({
  fileName: z.string().trim().min(1).max(500),
  contentBase64: z.string().min(1),
});

export const testPolicySchema = z.object({
  message: z.object({
    direction: z.enum(["Incoming", "Outgoing"]),
    sender: z.string().trim().email().max(320),
    recipients: z.array(z.string().trim().email().max(320)).min(1).max(50),
    subject: z.string().trim().max(500).optional().nullable(),
  }),
  attachments: z.array(attachmentInputSchema).max(20).default([]),
  urls: z.array(z.string().trim().max(2000)).max(50).default([]),
  scopeContext: z
    .object({
      departmentId: z.number().int().positive().optional().nullable(),
      staffId: z.number().int().positive().optional().nullable(),
      providerConnectionId: z.number().int().positive().optional().nullable(),
      groupTag: z.string().trim().max(100).optional().nullable(),
    })
    .optional(),
  sendTestNotifications: z.boolean().default(false),
});

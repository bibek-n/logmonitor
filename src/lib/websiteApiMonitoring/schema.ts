import { z } from "zod";

const VALID_INTERVALS_SECONDS = [30, 60, 120, 300, 600, 900, 1800, 3600];

export const createWebsiteMonitorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  environment: z.string().trim().max(50).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  intervalSeconds: z
    .number()
    .int()
    .default(300)
    .refine((v) => VALID_INTERVALS_SECONDS.includes(v), { message: "Must be one of the supported monitoring intervals" }),
  timeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
  failureConfirmCount: z.number().int().min(1).max(10).default(2),
  recoveryConfirmCount: z.number().int().min(1).max(10).default(1),
  alertPolicyId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  url: z.string().trim().url().max(2000),
  httpMethod: z.enum(["GET", "HEAD"]).default("GET"),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().min(0).max(10).default(5),
  sslVerify: z.boolean().default(true),
  expectedKeyword: z.string().trim().max(500).optional().nullable(),
  forbiddenKeyword: z.string().trim().max(500).optional().nullable(),
  responseTimeWarningMs: z.number().int().min(1).max(60_000).default(1000),
  responseTimeCriticalMs: z.number().int().min(1).max(60_000).default(3000),
  alertEmail: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.split(",").every((addr) => z.string().trim().email().safeParse(addr).success),
      { message: "Alert email must be one or more valid, comma-separated email addresses." }
    ),
});

export const updateWebsiteMonitorSchema = createWebsiteMonitorSchema.partial();

export const testWebsiteMonitorSchema = z.object({
  url: z.string().trim().url().max(2000),
  httpMethod: z.enum(["GET", "HEAD"]).default("GET"),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().min(0).max(10).default(5),
  sslVerify: z.boolean().default(true),
  expectedKeyword: z.string().trim().max(500).optional().nullable(),
  forbiddenKeyword: z.string().trim().max(500).optional().nullable(),
  timeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
});

// Destination's expected shape depends on contactType: Email needs a real email address,
// Slack/Teams/Webhook need a URL (their webhook endpoint), InApp needs a Username to deliver
// to. signingSecret only ever applies to Webhook (an optional HMAC secret the receiving end
// can use to verify the payload came from this app) - stored in AlertContacts.ConfigJson.
export const createAlertContactSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    contactType: z.enum(["Email", "Slack", "Teams", "Webhook", "InApp"]).default("Email"),
    destination: z.string().trim().min(1).max(500),
    signingSecret: z.string().trim().max(200).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.contactType === "Email" && !z.string().email().safeParse(v.destination).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: "Enter a valid email address for an Email contact." });
    }
    if ((v.contactType === "Slack" || v.contactType === "Teams" || v.contactType === "Webhook") && !z.string().url().safeParse(v.destination).success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["destination"], message: `Enter a valid webhook URL for a ${v.contactType} contact.` });
    }
  });

export const updateAlertContactSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contactType: z.enum(["Email", "Slack", "Teams", "Webhook", "InApp"]).optional(),
  destination: z.string().trim().min(1).max(500).optional(),
  signingSecret: z.string().trim().max(200).optional().nullable(),
  isActive: z.boolean().optional(),
});

const escalationStepSchema = z.object({
  delayMinutes: z.number().int().min(1).max(1440),
  contactIds: z.array(z.number().int().positive()).max(50),
});

// Quiet hours and escalation are both opt-in per policy (default off) so every existing policy
// keeps notifying exactly as it does today until someone deliberately configures either one.
export const createAlertPolicySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    isDefault: z.boolean().default(false),
    notifyOnDown: z.boolean().default(true),
    notifyOnRecovery: z.boolean().default(true),
    notifyOnDegraded: z.boolean().default(false),
    notifyOnSslExpiring: z.boolean().default(true),
    contactIds: z.array(z.number().int().positive()).max(50).default([]),
    quietHoursEnabled: z.boolean().default(false),
    quietHoursStart: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format")
      .optional()
      .nullable(),
    quietHoursEnd: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format")
      .optional()
      .nullable(),
    quietHoursTimezone: z.string().trim().min(1).max(50).default("UTC"),
    quietHoursAllowCritical: z.boolean().default(true),
    escalationEnabled: z.boolean().default(false),
    escalationSteps: z.array(escalationStepSchema).max(10).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.quietHoursEnabled && (!v.quietHoursStart || !v.quietHoursEnd)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["quietHoursStart"], message: "Set both a start and end time to enable quiet hours." });
    }
    if (v.escalationEnabled && v.escalationSteps.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["escalationSteps"], message: "Add at least one escalation step to enable escalation." });
    }
  });

export const updateAlertPolicySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  notifyOnDown: z.boolean().optional(),
  notifyOnRecovery: z.boolean().optional(),
  notifyOnDegraded: z.boolean().optional(),
  notifyOnSslExpiring: z.boolean().optional(),
  contactIds: z.array(z.number().int().positive()).max(50).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format")
    .optional()
    .nullable(),
  quietHoursEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM format")
    .optional()
    .nullable(),
  quietHoursTimezone: z.string().trim().min(1).max(50).optional(),
  quietHoursAllowCritical: z.boolean().optional(),
  escalationEnabled: z.boolean().optional(),
  escalationSteps: z.array(escalationStepSchema).max(10).optional(),
});

export const createMaintenanceWindowSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    isRecurring: z.boolean().default(false),
    recurrenceRule: z.enum(["Daily", "Weekly", "Monthly"]).optional().nullable(),
    isActive: z.boolean().default(true),
    monitorIds: z.array(z.number().int().positive()).min(1).max(500),
  })
  .refine((v) => v.endsAt.getTime() > v.startsAt.getTime(), { path: ["endsAt"], message: "End time must be after the start time." });

export const updateMaintenanceWindowSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.enum(["Daily", "Weekly", "Monthly"]).optional().nullable(),
  isActive: z.boolean().optional(),
  monitorIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
});

export const assignIncidentSchema = z.object({ userId: z.number().int().positive().nullable() });
export const addIncidentNoteSchema = z.object({ note: z.string().trim().min(1).max(2000) });
export const changeIncidentSeveritySchema = z.object({ severity: z.enum(["Low", "Medium", "High", "Critical"]) });
export const resolveIncidentSchema = z.object({ note: z.string().trim().max(2000).optional().nullable() });

export const updateMonitoringSettingsSchema = z.object({
  defaultIntervalSeconds: z.number().int().refine((v) => VALID_INTERVALS_SECONDS.includes(v)).optional(),
  defaultTimeoutMs: z.number().int().min(1000).max(60_000).optional(),
  defaultFailureConfirmCount: z.number().int().min(1).max(10).optional(),
  defaultRecoveryConfirmCount: z.number().int().min(1).max(10).optional(),
  defaultResponseWarningMs: z.number().int().min(1).max(60_000).optional(),
  defaultResponseCriticalMs: z.number().int().min(1).max(60_000).optional(),
  defaultAlertPolicyId: z.number().int().positive().optional().nullable(),
  dataRetentionDays: z.number().int().min(1).max(3650).optional(),
  maxResponseSizeBytes: z.number().int().min(1024).optional(),
  defaultUserAgent: z.string().trim().min(1).max(300).optional(),
  blockPrivateNetworks: z.boolean().optional(),
  maxRedirects: z.number().int().min(0).max(10).optional(),
});

export const sendMonitorReportSchema = z
  .object({
    contactIds: z.array(z.number().int().positive()).max(50).default([]),
    emails: z.array(z.string().trim().email()).max(50).default([]),
  })
  .refine((v) => v.contactIds.length + v.emails.length > 0, {
    message: "Select at least one alert contact or enter at least one email address.",
  });

// --- API Monitors (Phase 2) ---

const API_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const apiHeaderSchema = z.object({
  key: z.string().trim().min(1).max(200),
  value: z.string().max(4000),
});

// Secret fields (keyValue/token/password/clientSecret) are optional here on purpose: the
// frontend never receives a saved secret back (see maskApiAuthConfig), so a PUT that doesn't
// touch auth resubmits the mask placeholder untouched, and the [id] route treats a value equal
// to that placeholder (or empty) as "leave the existing secret alone" rather than overwriting
// it with a blank. A brand-new monitor with a real value goes through untouched.
const apiAuthConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("None") }),
  z.object({
    type: z.literal("ApiKey"),
    keyLocation: z.enum(["header", "query"]).default("header"),
    keyName: z.string().trim().min(1).max(200),
    keyValue: z.string().max(2000).optional().default(""),
  }),
  z.object({ type: z.literal("BearerToken"), token: z.string().max(4000).optional().default("") }),
  z.object({
    type: z.literal("BasicAuth"),
    username: z.string().trim().max(200),
    password: z.string().max(500).optional().default(""),
  }),
  z.object({
    type: z.literal("OAuth2ClientCredentials"),
    tokenUrl: z.string().trim().url().max(2000),
    clientId: z.string().trim().max(500),
    clientSecret: z.string().max(1000).optional().default(""),
    scope: z.string().trim().max(500).optional().nullable().default(null),
  }),
]);

const apiAssertionSchema = z.object({
  path: z.string().trim().min(1).max(500),
  operator: z.enum(["equals", "notEquals", "contains", "notContains", "exists", "notExists", "greaterThan", "lessThan", "matchesRegex"]),
  expectedValue: z.string().max(2000).optional().nullable().default(null),
});

export const createApiMonitorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  environment: z.string().trim().max(50).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  intervalSeconds: z
    .number()
    .int()
    .default(300)
    .refine((v) => VALID_INTERVALS_SECONDS.includes(v), { message: "Must be one of the supported monitoring intervals" }),
  timeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
  failureConfirmCount: z.number().int().min(1).max(10).default(2),
  recoveryConfirmCount: z.number().int().min(1).max(10).default(1),
  alertPolicyId: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().default(true),
  url: z.string().trim().url().max(2000),
  httpMethod: z.enum(API_HTTP_METHODS).default("GET"),
  headers: z.array(apiHeaderSchema).max(50).default([]),
  queryParams: z.array(apiHeaderSchema).max(50).default([]),
  requestBody: z.string().max(1_000_000).optional().nullable(),
  requestBodyContentType: z.string().trim().max(100).optional().nullable().default("application/json"),
  authType: z.enum(["None", "ApiKey", "BearerToken", "BasicAuth", "OAuth2ClientCredentials"]).default("None"),
  authConfig: apiAuthConfigSchema.default({ type: "None" }),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().min(0).max(10).default(5),
  sslVerify: z.boolean().default(true),
  assertions: z.array(apiAssertionSchema).max(50).default([]),
  responseTimeWarningMs: z.number().int().min(1).max(60_000).default(1000),
  responseTimeCriticalMs: z.number().int().min(1).max(60_000).default(3000),
  alertEmail: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .nullable()
    .refine(
      (v) => !v || v.split(",").every((addr) => z.string().trim().email().safeParse(addr).success),
      { message: "Alert email must be one or more valid, comma-separated email addresses." }
    ),
});

export const updateApiMonitorSchema = createApiMonitorSchema.partial();

export const testApiMonitorSchema = z.object({
  url: z.string().trim().url().max(2000),
  httpMethod: z.enum(API_HTTP_METHODS).default("GET"),
  headers: z.array(apiHeaderSchema).max(50).default([]),
  queryParams: z.array(apiHeaderSchema).max(50).default([]),
  requestBody: z.string().max(1_000_000).optional().nullable(),
  requestBodyContentType: z.string().trim().max(100).optional().nullable().default("application/json"),
  authType: z.enum(["None", "ApiKey", "BearerToken", "BasicAuth", "OAuth2ClientCredentials"]).default("None"),
  authConfig: apiAuthConfigSchema.default({ type: "None" }),
  expectedStatusCode: z.number().int().min(100).max(599).default(200),
  followRedirects: z.boolean().default(true),
  maxRedirects: z.number().int().min(0).max(10).default(5),
  sslVerify: z.boolean().default(true),
  assertions: z.array(apiAssertionSchema).max(50).default([]),
  timeoutMs: z.number().int().min(1000).max(60_000).default(10_000),
});

// --- Phase 4: SLA tracking, scheduled reports ---

export const upsertSlaConfigSchema = z.object({
  targetPercent: z.number().min(0).max(100),
  evaluationWindow: z.enum(["Daily", "Weekly", "Monthly"]).default("Monthly"),
});

export const createScheduledReportSchema = z.object({
  name: z.string().trim().min(1).max(200),
  frequency: z.enum(["Daily", "Weekly", "Monthly"]).default("Weekly"),
  format: z.enum(["Email", "Csv", "Pdf", "Excel"]).default("Email"),
  monitorScope: z.enum(["All", "Selected"]).default("All"),
  monitorIds: z.array(z.number().int().positive()).max(500).default([]),
  contactIds: z.array(z.number().int().positive()).max(50).default([]),
  recipientEmails: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .nullable()
    .refine((v) => !v || v.split(",").every((addr) => z.string().trim().email().safeParse(addr).success), {
      message: "Recipient emails must be one or more valid, comma-separated email addresses.",
    }),
  isActive: z.boolean().default(true),
});

export const updateScheduledReportSchema = createScheduledReportSchema.partial();

export { VALID_INTERVALS_SECONDS };

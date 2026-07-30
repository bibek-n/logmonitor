import { z } from "zod";

// A vulnerability scan targets either a tracked Website OR an explicitly-authorized ad-hoc URL
// (the two scan-target options confirmed with the user) - never a bare, unauthorized URL.
export const createVulnerabilityScanSchema = z
  .object({
    websiteId: z.number().int().positive().optional().nullable(),
    adHocUrl: z.string().trim().url().max(2000).optional().nullable(),
    authorizationConfirmed: z.boolean().default(false),
  })
  .refine((v) => !!v.websiteId || !!v.adHocUrl, {
    message: "Choose a tracked website or enter a URL to scan.",
    path: ["websiteId"],
  })
  .refine((v) => !!v.websiteId || v.authorizationConfirmed, {
    message: "Confirm you own or are explicitly authorized to assess this ad-hoc target.",
    path: ["authorizationConfirmed"],
  });

export const updateVulnerabilityFindingSchema = z.object({
  status: z.enum(["Open", "Confirmed", "FalsePositive", "Resolved", "Accepted"]).optional(),
  assignedEngineerUserId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(4000).optional().nullable(),
});

export const createWafRateLimitRuleSchema = z.object({
  websiteId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  requestsPerWindow: z.number().int().min(1).max(1_000_000),
  windowSeconds: z.number().int().min(1).max(86_400),
  action: z.enum(["Block", "Challenge", "LogOnly"]).default("LogOnly"),
  isActive: z.boolean().default(true),
});
export const updateWafRateLimitRuleSchema = createWafRateLimitRuleSchema.partial();

export const createWafCustomRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  matchType: z.enum(["UrlPattern", "UserAgentPattern", "HeaderPattern"]),
  matchValue: z.string().trim().min(1).max(1000),
  action: z.enum(["Block", "Allow", "LogOnly"]).default("LogOnly"),
  isActive: z.boolean().default(true),
});
export const updateWafCustomRuleSchema = createWafCustomRuleSchema.partial();

export const createWafCountryRuleSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/, "Use a 2-letter ISO country code")
    .transform((v) => v.toUpperCase()),
  action: z.enum(["Block", "Allow"]).default("Block"),
  isActive: z.boolean().default(true),
});
export const updateWafCountryRuleSchema = createWafCountryRuleSchema.partial();

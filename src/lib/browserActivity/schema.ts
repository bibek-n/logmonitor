import { z } from "zod";

const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// Ingest payload from the agent — deliberately narrow (see the approved plan's data
// minimization section). No url field exists here at all; the agent never sends one.
export const ingestBrowserActivitySchema = z.object({
  events: z
    .array(
      z.object({
        browser: z.enum(["chrome", "edge", "firefox"]),
        domain: z.string().trim().toLowerCase().regex(domainRegex).max(255),
        pageTitle: z.string().trim().max(500).nullable().optional().default(null),
        visitedAt: z.string().datetime(),
        dwellSeconds: z.number().int().min(0).max(86_400).nullable().optional().default(null),
      })
    )
    .max(500), // one heartbeat interval's worth, bounded against a misbehaving agent flooding the endpoint
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  riskLevel: z.enum(["none", "low", "medium", "high"]).default("none"),
});
export const updateCategorySchema = createCategorySchema.partial();

export const createCategoryRuleSchema = z.object({
  domain: z.string().trim().toLowerCase().regex(domainRegex).max(255),
  categoryId: z.number().int().positive(),
  matchType: z.enum(["exact", "suffix"]).default("suffix"),
});

export const createExcludedDomainSchema = z.object({
  domain: z.string().trim().toLowerCase().regex(domainRegex).max(255),
  reason: z.enum(["personal", "medical", "banking", "union", "legal", "other"]),
  notes: z.string().trim().max(500).nullable().optional().default(null),
});

export const updateSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).optional(),
  collectPageTitles: z.boolean().optional(),
  defaultIntervalMinutes: z.number().int().min(1).max(1440).optional(),
});

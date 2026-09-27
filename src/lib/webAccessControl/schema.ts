import { z } from "zod";

// Zod validation for the Web Access Control module's admin-facing payloads - the app-level
// gate enforced on every web-access-control API route, independent of the DB's CHECK
// constraints (which only reject truly invalid rows, not e.g. a Staff-scope rule missing a
// StaffId).

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM (24h)");

const DAY_CODES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const createScheduleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  daysOfWeek: z.array(z.enum(DAY_CODES)).min(1).max(7).nullable().optional(),
  startTime: timeString.nullable().optional(),
  endTime: timeString.nullable().optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

const ruleBaseSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "Must be a valid domain (e.g. facebook.com)"),
  matchType: z.enum(["exact", "suffix"]).default("suffix"),
  action: z.enum(["Allow", "Block"]),
  scopeType: z.enum(["Staff", "Group", "Global"]),
  staffId: z.number().int().positive().nullable().optional(),
  wacGroupId: z.number().int().positive().nullable().optional(),
  scheduleId: z.number().int().positive().nullable().optional(),
  priority: z.enum(["Low", "Normal", "High"]).default("Normal"),
  status: z.enum(["Enabled", "Disabled"]).default("Enabled"),
});

// A rule's target must match its declared scope - a Staff-scope rule with no StaffId (or a
// Group-scope rule with no WacGroupId) is meaningless and would silently never match
// anything in rulesEngine.ts, so this is rejected up front rather than saved as a dead rule.
function refineScopeTarget<T extends z.infer<typeof ruleBaseSchema>>(data: T, ctx: z.RefinementCtx) {
  if (data.scopeType === "Staff" && !data.staffId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "staffId is required when scopeType is 'Staff'", path: ["staffId"] });
  }
  if (data.scopeType === "Group" && !data.wacGroupId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "wacGroupId is required when scopeType is 'Group'", path: ["wacGroupId"] });
  }
  if (data.scopeType === "Global" && (data.staffId || data.wacGroupId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "staffId/wacGroupId must not be set when scopeType is 'Global'", path: ["scopeType"] });
  }
}

export const createRuleSchema = ruleBaseSchema.superRefine(refineScopeTarget);
export const updateRuleSchema = ruleBaseSchema.partial().extend({
  // scopeType is required on update too whenever a target field changes, but since this is a
  // partial update the route re-fetches the existing row and merges before re-validating the
  // merged result against createRuleSchema - see rules/[id]/route.ts.
});

export const createAllowlistEntrySchema = z
  .object({
    serviceName: z.string().trim().min(1).max(200),
    domain: z.string().trim().toLowerCase().max(255).nullable().optional(),
    ipAddress: z.string().trim().max(45).nullable().optional(),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    matchType: z.enum(["exact", "suffix"]).default("suffix"),
    isCritical: z.boolean().default(true),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((d) => !!d.domain || !!d.ipAddress, { message: "Either domain or ipAddress is required", path: ["domain"] });

export const updateAllowlistEntrySchema = z.object({
  serviceName: z.string().trim().min(1).max(200).optional(),
  domain: z.string().trim().toLowerCase().max(255).nullable().optional(),
  ipAddress: z.string().trim().max(45).nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  matchType: z.enum(["exact", "suffix"]).optional(),
  isCritical: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  // Server-side enforcement of the spec's explicit-warning requirement, not just a UI
  // affordance - PATCH/DELETE on a critical allowlist row is rejected unless the caller
  // (the confirmed UI dialog) sends this flag.
  acknowledged: z.literal(true, { errorMap: () => ({ message: "Must acknowledge the critical-allowlist warning before proceeding" }) }),
});

export const deleteAllowlistEntrySchema = z.object({
  acknowledged: z.literal(true, { errorMap: () => ({ message: "Must acknowledge the critical-allowlist warning before proceeding" }) }),
});

export const previewAccessSchema = z.object({
  domain: z.string().trim().toLowerCase().min(1).max(255),
  staffId: z.number().int().positive(),
});

export const assignStaffGroupSchema = z.object({
  wacGroupId: z.number().int().positive().nullable(),
});

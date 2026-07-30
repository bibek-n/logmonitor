import { z } from "zod";

const MAX_SCRIPT_BODY_CHARS = 200_000; // generous - a web shell or a runaway paste is still nowhere near this

export const createScriptSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(1000).optional().nullable(),
    powerShellBody: z.string().max(MAX_SCRIPT_BODY_CHARS).optional().nullable(),
    bashBody: z.string().max(MAX_SCRIPT_BODY_CHARS).optional().nullable(),
    timeoutSeconds: z.number().int().min(5).max(3600).default(300),
  })
  .refine((v) => !!v.powerShellBody?.trim() || !!v.bashBody?.trim(), {
    message: "Provide at least a PowerShell body (for Windows targets) or a Bash body (for Linux targets).",
    path: ["powerShellBody"],
  });

export const updateScriptSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  powerShellBody: z.string().max(MAX_SCRIPT_BODY_CHARS).optional().nullable(),
  bashBody: z.string().max(MAX_SCRIPT_BODY_CHARS).optional().nullable(),
  timeoutSeconds: z.number().int().min(5).max(3600).optional(),
});

// "Run Now" - queues one AutomationJob targeting every listed device. deviceIds is capped at
// a sane fleet size; the enrolled-device count in this app has never approached this.
export const runJobSchema = z.object({
  scriptId: z.number().int().positive(),
  deviceIds: z.array(z.string().trim().min(1).max(36)).min(1).max(500),
});

export const createScheduleSchema = z.object({
  scriptId: z.number().int().positive(),
  name: z.string().trim().min(1).max(200),
  intervalMinutes: z.number().int().min(1).max(43_200), // 1 minute .. 30 days
  isActive: z.boolean().default(true),
  deviceIds: z.array(z.string().trim().min(1).max(36)).min(1).max(500),
});

export const updateScheduleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  intervalMinutes: z.number().int().min(1).max(43_200).optional(),
  isActive: z.boolean().optional(),
  deviceIds: z.array(z.string().trim().min(1).max(36)).min(1).max(500).optional(),
});

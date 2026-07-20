import { z } from "zod";
import { repoSourceFields, hasRepoSource } from "@/lib/repoConnectionsShared";

export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

export function parsePagination(sp: URLSearchParams): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize")) || PAGE_SIZE_DEFAULT));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export const projectStatusSchema = z.enum(["Active", "Inactive"]);

// sourcePath is required for a manually-pathed project but omitted entirely for a
// repo-backed one (its SourcePath is computed by the initial sync instead - see
// projects/route.ts POST). Kept as a plain ZodObject (not wrapped in superRefine) so
// [id]/route.ts's PUT handler can still call .partial() on it directly - the "one or the
// other" requirement is enforced separately by createProjectSchema below, used only for POST.
// The repo-source fields (repoConnectionId/repoProvider/repositoryOwner/repositoryName/
// repositoryRef) are shared with every other module's project schema - see
// repoConnectionsShared.ts.
export const upsertProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  repositoryUrl: z.string().trim().max(500).optional().nullable(),
  sourcePath: z.string().trim().min(1).max(1000).optional(),
  defaultBranch: z.string().trim().max(200).optional().nullable(),
  language: z.string().trim().max(50).optional().nullable(),
  scanConfig: z.record(z.unknown()).optional().nullable(),
  status: projectStatusSchema.optional(),
  ...repoSourceFields,
});

export const createProjectSchema = upsertProjectSchema.superRefine((val, ctx) => {
  if (!hasRepoSource(val) && !val.sourcePath) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide sourcePath, or repoConnectionId + repoProvider + repositoryOwner + repositoryName.",
    });
  }
});

export const startScanSchema = z.object({
  branch: z.string().trim().max(200).optional().nullable(),
  scanType: z.enum(["Full", "Incremental"]).optional(),
  includedDirectories: z.array(z.string().trim().max(500)).max(50).optional(),
  excludedDirectories: z.array(z.string().trim().max(200)).max(100).optional(),
  complexityThreshold: z.number().int().min(1).max(200).optional(),
  duplicationThreshold: z.number().min(0).max(100).optional(),
  enabledRuleCodes: z.array(z.string().trim().max(100)).max(200).optional(),
});

export const issueStatusSchema = z.enum(["Open", "Confirmed", "Resolved", "Ignored", "FalsePositive"]);
export const issueCategorySchema = z.enum(["Complexity", "Duplication", "DeadCode", "UnusedVariable", "UnusedFunction", "CodingStandard"]);
export const issueSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);

export const updateIssueSchema = z.object({
  status: issueStatusSchema.optional(),
  resolutionNote: z.string().trim().max(2000).optional().nullable(),
});

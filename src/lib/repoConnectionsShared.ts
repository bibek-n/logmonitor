import { z } from "zod";

// Shared across every module's Add/Edit Project form - GitHub identifiers stay slash-free
// (owner/repo are always separate segments); GitLab's path_with_namespace can contain slashes
// (subgroups), so it gets its own, more permissive field rather than overloading the GitHub
// one's regex.
const githubIdentifier = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9._-]+$/, "Must contain only letters, numbers, dots, hyphens, and underscores.");
const gitlabPathIdentifier = z.string().trim().min(1).max(300).regex(/^[a-zA-Z0-9._/-]+$/, "Must contain only letters, numbers, dots, hyphens, underscores, and slashes.");

export const createRepoConnectionSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("GitHub"), name: z.string().trim().min(1).max(200), token: z.string().trim().min(1).max(500) }),
  z.object({
    provider: z.literal("GitLab"),
    name: z.string().trim().min(1).max(200),
    instanceUrl: z.string().trim().min(1).max(500).url("Must be a valid URL, e.g. https://gitlab.example.com"),
    token: z.string().trim().min(1).max(500),
  }),
]);

// A project's repo source, shared by every module's create/update project schema - spread
// this into a module-specific z.object() alongside that module's own fields (name,
// description, etc.), then apply the same "sourcePath OR repo source" superRefine each module
// already needs.
export const repoSourceFields = {
  repoConnectionId: z.number().int().positive().optional(),
  repoProvider: z.enum(["GitHub", "GitLab"]).optional(),
  repositoryOwner: githubIdentifier.optional(), // GitHub: literal owner. GitLab: numeric project id as a string (see repoConnections/sync.ts).
  repositoryName: gitlabPathIdentifier.optional(), // GitHub: repo name (also matches the stricter GitHub identifier pattern). GitLab: path_with_namespace.
  repositoryRef: z.string().trim().min(1).max(200).optional(),
};

export function hasRepoSource(val: { repoConnectionId?: number; repoProvider?: string; repositoryOwner?: string; repositoryName?: string }): boolean {
  return val.repoConnectionId !== undefined && val.repoProvider !== undefined && val.repositoryOwner !== undefined && val.repositoryName !== undefined;
}

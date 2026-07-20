export type RepoProvider = "GitHub" | "GitLab";
export type RepoAuthMethod = "PAT" | "OAuthApp" | "GitHubApp";

// The row shape every module reads from the shared RepoConnections table - deliberately
// provider-agnostic so runScan.ts in any module (Code Quality, Laravel Security, future ones)
// never needs its own copy of "what a GitHub vs GitLab connection looks like."
export interface RepoConnectionRow {
  id: number;
  provider: RepoProvider;
  authMethod: RepoAuthMethod;
  instanceUrl: string | null; // GitHub: null (github.com is fixed). GitLab: required, the self-hosted base URL.
  accessTokenEncrypted: string | null; // null only for a GitHubApp connection (see repoConnections/github/sync.ts)
  installationId: number | null; // GitHub App installations only
}

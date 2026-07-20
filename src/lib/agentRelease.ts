export const AGENT_REPO = "bibek-n/logmonitor";

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tag_name: string;
  assets: ReleaseAsset[];
}

// Shared by the Download Agent page and the Enroll Device page, so both show the same
// live release info instead of two independent GitHub API calls with slightly different
// caching behavior.
export async function getLatestAgentRelease(): Promise<ReleaseInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${AGENT_REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as ReleaseInfo;
  } catch {
    return null;
  }
}

export function findReleaseAsset(release: ReleaseInfo | null, name: string): ReleaseAsset | undefined {
  return release?.assets.find((a) => a.name === name);
}

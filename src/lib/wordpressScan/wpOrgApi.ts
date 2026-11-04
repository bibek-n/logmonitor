// WordPress.org's own update-check API - the same endpoint every WordPress install itself
// calls to ask "is there a newer core release." Completely free, no auth/token required,
// unlike the WPScan vulnerability-database API (wpscanApi.ts) which needs a registered
// WPSCAN_API_TOKEN that isn't configured here. This is what makes "latest version"/"upgrade
// to X" work out of the box, without that external signup.
const WP_ORG_VERSION_CHECK_URL = "https://api.wordpress.org/core/version-check/1.7/?locale=en_US";
const FETCH_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — this is the same global "latest release" for
// every site scanned, so a bulk "Scan All" run shouldn't re-fetch it once per site.

export interface WpOrgLatest {
  latestVersion: string | null;
  // The minimum PHP version WordPress.org's own installer recommends for the latest release —
  // used to flag a site whose PHP is too old to safely run the current WordPress version.
  requiredPhpVersion: string | null;
}

interface VersionCheckOffer {
  version?: string;
  current?: string;
  php_version?: string;
}

let cached: { value: WpOrgLatest; at: number } | null = null;

export async function getLatestWordPressRelease(): Promise<WpOrgLatest> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const fallback: WpOrgLatest = { latestVersion: null, requiredPhpVersion: null };
  try {
    const res = await fetch(WP_ORG_VERSION_CHECK_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return fallback;
    const data = (await res.json()) as { offers?: VersionCheckOffer[] };
    const offer = data.offers?.[0];
    if (!offer) return fallback;

    const value: WpOrgLatest = {
      latestVersion: offer.version ?? offer.current ?? null,
      requiredPhpVersion: offer.php_version ?? null,
    };
    cached = { value, at: Date.now() };
    return value;
  } catch {
    return fallback;
  }
}

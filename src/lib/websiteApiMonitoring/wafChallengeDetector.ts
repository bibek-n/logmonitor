// Detects whether an HTTP response is a WAF/anti-bot challenge page (Cloudflare, Sucuri,
// Akamai, generic reCAPTCHA/hCaptcha walls) rather than the site's real content. This exists
// because a monitor that keeps hitting a challenge page at its normal check interval (every
// few minutes, forever, since the checker can't solve a Captcha) is exactly the "crawler
// without a rate-limit" pattern that gets an IP permanently blocked for repeated Captcha
// failures — confirmed as the root cause of a real block on this app's own outbound IP. The
// fix is not to try to evade or solve the challenge (out of scope and against most WAFs'
// terms) but to recognize it and back off hard — see the backoff logic in
// run-website-api-monitoring-scan.ts that consumes this signal.
const CHALLENGE_HEADER_MARKERS: { header: string; valueContains: string }[] = [
  { header: "cf-mitigated", valueContains: "challenge" },
  { header: "x-sucuri-block", valueContains: "" },
  { header: "server", valueContains: "cloudflare" }, // only meaningful combined with a challenge status code below
];

const CHALLENGE_STATUS_CODES = new Set([403, 503]);

// Body substrings are matched case-insensitively against a bounded excerpt only (never a full
// page) — checked only when the status code also looks like a challenge, except for the most
// distinctive Cloudflare interstitial markers, which are specific enough to stand alone even
// under an unusual status code.
const DISTINCTIVE_BODY_MARKERS = ["cdn-cgi/challenge-platform", "__cf_chl_", "just a moment...", "checking your browser before accessing"];

const GENERIC_BODY_MARKERS = ["captcha", "recaptcha", "hcaptcha", "verify you are human", "attention required", "access denied"];

export function detectWafChallenge(statusCode: number, bodyExcerpt: string, headers: Record<string, string | string[] | undefined>): boolean {
  const lowerBody = bodyExcerpt.slice(0, 4000).toLowerCase();

  if (DISTINCTIVE_BODY_MARKERS.some((m) => lowerBody.includes(m))) return true;

  const isChallengeStatus = CHALLENGE_STATUS_CODES.has(statusCode);
  if (!isChallengeStatus) return false;

  if (GENERIC_BODY_MARKERS.some((m) => lowerBody.includes(m))) return true;

  for (const marker of CHALLENGE_HEADER_MARKERS) {
    const raw = headers[marker.header];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.toLowerCase();
    if (value !== undefined && (marker.valueContains === "" || value.includes(marker.valueContains))) {
      return true;
    }
  }

  return false;
}

// Exponential backoff for a monitor that's being challenge-walled: doubles per consecutive
// failure, capped at 24h so a permanently-blocked site doesn't silently stop being checked
// forever — an admin/report will still see it recover eventually if the block lifts. Deliberately
// steeper than a normal failure retry (which stays at the configured interval) since the whole
// point is to stop generating the request volume that triggered the block in the first place.
const MAX_BACKOFF_SECONDS = 24 * 60 * 60;

export function computeWafBackoffSeconds(baseIntervalSeconds: number, consecutiveFailures: number): number {
  const exponent = Math.min(consecutiveFailures, 10);
  return Math.min(baseIntervalSeconds * 2 ** exponent, MAX_BACKOFF_SECONDS);
}

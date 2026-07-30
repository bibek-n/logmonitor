import { ContentCheckResult, WebsiteMonitorConfig } from "./types";

// Validates page content against a monitor's required/forbidden keyword rules. Never returns,
// logs, or persists the body itself - only the pass/fail result and which rule tripped, per
// the spec's explicit "do not store complete response bodies" requirement. Case-insensitive
// substring match (the spec's simplest, most common case) - exact/regex/HTML-title matching
// are richer content-rule types reserved for a later phase, not needed for Phase 1's
// required/forbidden keyword + empty-body checks.
export function checkContent(body: string, config: Pick<WebsiteMonitorConfig, "expectedKeyword" | "forbiddenKeyword">): ContentCheckResult {
  const hasExpectedRule = !!config.expectedKeyword;
  const hasForbiddenRule = !!config.forbiddenKeyword;

  if (!hasExpectedRule && !hasForbiddenRule) {
    return { passed: true, expectedKeywordFound: null, forbiddenKeywordFound: null, reason: null };
  }

  const haystack = body.toLowerCase();

  const expectedKeywordFound = hasExpectedRule ? haystack.includes(config.expectedKeyword!.toLowerCase()) : null;
  if (hasExpectedRule && !expectedKeywordFound) {
    return {
      passed: false,
      expectedKeywordFound,
      forbiddenKeywordFound: null,
      reason: `Required keyword "${config.expectedKeyword}" was not found on the page.`,
    };
  }

  const forbiddenKeywordFound = hasForbiddenRule ? haystack.includes(config.forbiddenKeyword!.toLowerCase()) : null;
  if (hasForbiddenRule && forbiddenKeywordFound) {
    return {
      passed: false,
      expectedKeywordFound,
      forbiddenKeywordFound,
      reason: `Forbidden keyword "${config.forbiddenKeyword}" was found on the page.`,
    };
  }

  return { passed: true, expectedKeywordFound, forbiddenKeywordFound, reason: null };
}

export function checkEmptyBody(body: string): ContentCheckResult | null {
  if (body.trim().length === 0) {
    return { passed: false, expectedKeywordFound: null, forbiddenKeywordFound: null, reason: "Response body is empty." };
  }
  return null;
}

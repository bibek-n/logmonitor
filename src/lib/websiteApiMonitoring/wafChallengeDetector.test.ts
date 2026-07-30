import { describe, it, expect } from "vitest";
import { detectWafChallenge, computeWafBackoffSeconds } from "./wafChallengeDetector";

describe("detectWafChallenge", () => {
  it("detects a Cloudflare JS-challenge interstitial regardless of status code", () => {
    const body = "<html><head><title>Just a moment...</title></head><body>cdn-cgi/challenge-platform</body></html>";
    expect(detectWafChallenge(200, body, {})).toBe(true);
  });

  it("does not flag a normal 200 response with ordinary content", () => {
    const body = "<html><body><h1>Welcome to our site</h1></body></html>";
    expect(detectWafChallenge(200, body, {})).toBe(false);
  });

  it("detects a generic captcha wall on a 403", () => {
    const body = "<html><body>Please complete the captcha to continue.</body></html>";
    expect(detectWafChallenge(403, body, {})).toBe(true);
  });

  it("does not flag generic captcha wording on a normal 200 status", () => {
    // A real page that merely mentions "captcha" in unrelated copy (e.g. describing a login
    // form) must not be misclassified - only paired with a challenge-like status code.
    const body = "<html><body>Our signup form uses a captcha for spam protection.</body></html>";
    expect(detectWafChallenge(200, body, {})).toBe(false);
  });

  it("detects via the cf-mitigated challenge header on a 403", () => {
    expect(detectWafChallenge(403, "", { "cf-mitigated": "challenge" })).toBe(true);
  });

  it("does not flag a plain 403 with no challenge markers at all", () => {
    expect(detectWafChallenge(403, "<html><body>Forbidden</body></html>", {})).toBe(false);
  });

  it("does not flag a plain 503 maintenance page with no challenge markers", () => {
    expect(detectWafChallenge(503, "<html><body>Service temporarily unavailable</body></html>", {})).toBe(false);
  });
});

describe("computeWafBackoffSeconds", () => {
  it("doubles per consecutive failure", () => {
    expect(computeWafBackoffSeconds(60, 0)).toBe(60);
    expect(computeWafBackoffSeconds(60, 1)).toBe(120);
    expect(computeWafBackoffSeconds(60, 2)).toBe(240);
  });

  it("caps at 24 hours regardless of how large the exponent grows", () => {
    expect(computeWafBackoffSeconds(3600, 20)).toBe(24 * 60 * 60);
  });

  it("never lets a large base interval multiplied by backoff exceed the cap", () => {
    expect(computeWafBackoffSeconds(3600, 10)).toBe(24 * 60 * 60);
  });
});

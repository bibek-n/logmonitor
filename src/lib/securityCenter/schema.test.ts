import { describe, it, expect } from "vitest";
import { createVulnerabilityScanSchema } from "./schema";

describe("createVulnerabilityScanSchema", () => {
  it("accepts a tracked website target with no authorization checkbox needed", () => {
    const result = createVulnerabilityScanSchema.safeParse({ websiteId: 1, authorizationConfirmed: false });
    expect(result.success).toBe(true);
  });

  it("rejects an ad-hoc URL without the authorization checkbox", () => {
    const result = createVulnerabilityScanSchema.safeParse({ adHocUrl: "https://example.com", authorizationConfirmed: false });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("authorizationConfirmed"))).toBe(true);
    }
  });

  it("accepts an ad-hoc URL when the authorization checkbox is confirmed", () => {
    const result = createVulnerabilityScanSchema.safeParse({ adHocUrl: "https://example.com", authorizationConfirmed: true });
    expect(result.success).toBe(true);
  });

  it("rejects when neither a websiteId nor an adHocUrl is provided", () => {
    const result = createVulnerabilityScanSchema.safeParse({ authorizationConfirmed: true });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed ad-hoc URL", () => {
    const result = createVulnerabilityScanSchema.safeParse({ adHocUrl: "not-a-url", authorizationConfirmed: true });
    expect(result.success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { generatePerformanceReportPdf, performanceReportFilename } from "./reportPdf";

describe("performanceReportFilename", () => {
  it("slugifies the website name and lowercases the device", () => {
    expect(performanceReportFilename("Acme Corp!", "Mobile", "2026-01-15")).toBe("acme-corp-performance-mobile-2026-01-15.pdf");
  });

  it("falls back to 'website' when the name has no usable characters", () => {
    expect(performanceReportFilename("!!!", "Desktop", "2026-01-15")).toBe("website-performance-desktop-2026-01-15.pdf");
  });
});

describe("generatePerformanceReportPdf", () => {
  it("produces a non-empty PDF buffer even when there is no completed scan", async () => {
    const buffer = await generatePerformanceReportPdf({
      websiteName: "Example",
      websiteUrl: "https://example.com",
      device: "Mobile",
      scan: null,
      resources: null,
      checks: [],
      history: [],
    });
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("%PDF");
  });
});

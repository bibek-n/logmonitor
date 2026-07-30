import { describe, it, expect } from "vitest";
import { buildReportCsv, buildReportExcel } from "./reportExport";
import type { WebsiteMonitorReportRow } from "./repository";

function row(overrides: Partial<WebsiteMonitorReportRow>): WebsiteMonitorReportRow {
  return {
    id: 1,
    name: "Example",
    url: "https://example.com",
    environment: "Production",
    status: "Up",
    lastCheckedAt: "2026-01-01T00:00:00Z",
    lastResponseMs: 120,
    uptimePercent7d: 99.99,
    openIncidents: 0,
    ...overrides,
  };
}

describe("buildReportCsv", () => {
  it("produces a header row plus one data row per monitor", () => {
    const csv = buildReportCsv([row({}), row({ name: "Second", status: "Down" })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Name,URL,Status,Uptime (7d),Last Response,Open Incidents");
    expect(lines[1]).toContain("Example");
    expect(lines[2]).toContain("Second");
  });

  it("renders null uptime/response as a dash", () => {
    const csv = buildReportCsv([row({ uptimePercent7d: null, lastResponseMs: null })]);
    expect(csv).toContain("-,-,0");
  });

  it("quotes a field containing a comma per RFC 4180", () => {
    const csv = buildReportCsv([row({ name: "Site, Inc." })]);
    expect(csv).toContain('"Site, Inc."');
  });

  it("escapes an embedded quote by doubling it", () => {
    const csv = buildReportCsv([row({ name: 'The "Big" Site' })]);
    expect(csv).toContain('"The ""Big"" Site"');
  });

  it("handles an empty row list by emitting just the header", () => {
    const csv = buildReportCsv([]);
    expect(csv.split("\r\n")).toHaveLength(1);
  });
});

describe("buildReportExcel", () => {
  it("produces a non-empty xlsx buffer", async () => {
    const buffer = await buildReportExcel([row({})]);
    expect(buffer.length).toBeGreaterThan(0);
    // xlsx files are zip archives - "PK" magic bytes at the start confirm a real archive was written.
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });
});

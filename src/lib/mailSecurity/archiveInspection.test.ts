import { describe, it, expect } from "vitest";
import zlib from "zlib";
import { inspectArchive } from "./archiveInspection";
import { buildZipBuffer, highlyCompressibleBuffer } from "./testHelpers";
import { DEFAULT_ARCHIVE_LIMITS } from "./types";

describe("inspectArchive - zip", () => {
  it("detects a nested executable inside a zip", async () => {
    const zip = await buildZipBuffer([
      { name: "readme.txt", content: Buffer.from("hello") },
      { name: "payload.exe", content: Buffer.from("MZ fake pe header") },
    ]);
    const findings = await inspectArchive(zip, "zip", DEFAULT_ARCHIVE_LIMITS);
    expect(findings.nestedExecutables).toContain("payload.exe");
    expect(findings.totalEntries).toBe(2);
    expect(findings.corrupted).toBe(false);
  });

  it("flags a decompression-bomb-like entry via the compression-ratio guard", async () => {
    const zip = await buildZipBuffer([{ name: "bomb.bin", content: highlyCompressibleBuffer(5 * 1024 * 1024) }]);
    const findings = await inspectArchive(zip, "zip", { ...DEFAULT_ARCHIVE_LIMITS, maxCompressionRatio: 50 });
    expect(findings.truncatedForSafety).toBe(true);
    expect(findings.truncationReason).toMatch(/compression ratio|possible decompression bomb/i);
  });

  it("flags total extracted size exceeding the configured limit", async () => {
    const zip = await buildZipBuffer([
      { name: "a.bin", content: Buffer.from("not very compressible but large enough " + "x".repeat(2000)) },
    ]);
    const findings = await inspectArchive(zip, "zip", { ...DEFAULT_ARCHIVE_LIMITS, maxExtractedSizeBytes: 100 });
    expect(findings.truncatedForSafety).toBe(true);
    expect(findings.truncationReason).toMatch(/total extracted size/i);
  });

  it("reports corrupted for garbage bytes that aren't a valid zip", async () => {
    const garbage = Buffer.from("this is not a zip file at all, just plain text bytes");
    const findings = await inspectArchive(garbage, "zip", DEFAULT_ARCHIVE_LIMITS);
    expect(findings.corrupted).toBe(true);
  });

  it("respects maxExtractedFiles", async () => {
    const entries = Array.from({ length: 10 }, (_, i) => ({ name: `f${i}.txt`, content: Buffer.from("x") }));
    const zip = await buildZipBuffer(entries);
    const findings = await inspectArchive(zip, "zip", { ...DEFAULT_ARCHIVE_LIMITS, maxExtractedFiles: 3 });
    expect(findings.truncatedForSafety).toBe(true);
    expect(findings.truncationReason).toMatch(/file count/i);
  });
});

describe("inspectArchive - gzip", () => {
  it("flags a gzip decompression bomb before fully inflating it", async () => {
    const bomb = zlib.gzipSync(highlyCompressibleBuffer(3 * 1024 * 1024));
    const findings = await inspectArchive(bomb, "gzip", { ...DEFAULT_ARCHIVE_LIMITS, maxExtractedSizeBytes: 1024 * 1024 });
    expect(findings.truncatedForSafety).toBe(true);
  });

  it("inspects a normal small gzip payload without flagging it", async () => {
    const payload = zlib.gzipSync(Buffer.from("just a small log line"));
    const findings = await inspectArchive(payload, "gzip", DEFAULT_ARCHIVE_LIMITS);
    expect(findings.truncatedForSafety).toBe(false);
    expect(findings.corrupted).toBe(false);
  });
});

describe("inspectArchive - proprietary formats", () => {
  it("routes RAR to the uninspectable path without attempting to decode it", async () => {
    const findings = await inspectArchive(Buffer.from("Rar!\x1a\x07\x00fake"), "rar", DEFAULT_ARCHIVE_LIMITS);
    expect(findings.truncatedForSafety).toBe(true);
    expect(findings.truncationReason).toMatch(/RAR/i);
  });

  it("routes 7Z to the uninspectable path without attempting to decode it", async () => {
    const findings = await inspectArchive(Buffer.from("7z\xbc\xaf\x27\x1cfake"), "7z", DEFAULT_ARCHIVE_LIMITS);
    expect(findings.truncatedForSafety).toBe(true);
    expect(findings.truncationReason).toMatch(/7Z/i);
  });
});

import { describe, it, expect } from "vitest";
import { inspectFile } from "./fileInspection";
import { buildZipBuffer } from "./testHelpers";
import { DEFAULT_ARCHIVE_LIMITS } from "./types";

describe("inspectFile", () => {
  it("catches a renamed executable (PE header, .txt extension)", async () => {
    const buf = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("this is actually an exe")]);
    const result = await inspectFile("invoice.txt", buf, DEFAULT_ARCHIVE_LIMITS);
    expect(result.extensionMismatch).toBe(true);
    expect(result.characteristics.executableContent).toBe(true);
    expect(result.detectedFileType).toMatch(/executable/i);
  });

  it("flags a double extension where the final extension is executable", async () => {
    const result = await inspectFile("invoice.pdf.exe", Buffer.from("plain content, extension is what matters here"), DEFAULT_ARCHIVE_LIMITS);
    expect(result.characteristics.doubleExtension).toBe(true);
  });

  it("flags a file with no extension at all", async () => {
    const result = await inspectFile("README", Buffer.from("plain text"), DEFAULT_ARCHIVE_LIMITS);
    expect(result.characteristics.noExtension).toBe(true);
  });

  it("computes a stable SHA-256 hash and reports size", async () => {
    const content = Buffer.from("deterministic content");
    const result = await inspectFile("file.txt", content, DEFAULT_ARCHIVE_LIMITS);
    expect(result.hash).toHaveLength(64);
    expect(result.sizeBytes).toBe(content.length);
  });

  it("walks a zip attachment and surfaces a nested executable as uninspectable-safe metadata", async () => {
    const zip = await buildZipBuffer([{ name: "tool.exe", content: Buffer.from("MZ fake") }]);
    const result = await inspectFile("bundle.zip", zip, DEFAULT_ARCHIVE_LIMITS);
    expect(result.archiveFindings?.nestedExecutables).toContain("tool.exe");
    expect(result.characteristics.executableContent).toBe(true);
  });

  it("does not flag a plain text file with a normal extension", async () => {
    const result = await inspectFile("notes.txt", Buffer.from("just some notes"), DEFAULT_ARCHIVE_LIMITS);
    expect(result.extensionMismatch).toBe(false);
    expect(result.characteristics.executableContent).toBe(false);
    expect(result.uninspectableReason).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { detectFileType, hasMacroIndicators, isArchiveExtension, isExecutableExtension } from "./signatures";

describe("detectFileType", () => {
  it("detects a Windows PE/EXE by magic bytes regardless of extension", () => {
    const buf = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from("rest of a fake exe")]);
    const result = detectFileType(buf);
    expect(result?.isExecutable).toBe(true);
    expect(result?.mimeType).toBe("application/x-msdownload");
  });

  it("detects a Linux ELF binary", () => {
    const buf = Buffer.concat([Buffer.from([0x7f, 0x45, 0x4c, 0x46]), Buffer.alloc(20)]);
    expect(detectFileType(buf)?.isExecutable).toBe(true);
  });

  it("detects a PDF by its %PDF header", () => {
    const buf = Buffer.from("%PDF-1.7\n rest of document");
    expect(detectFileType(buf)?.mimeType).toBe("application/pdf");
  });

  it("detects a plain zip archive", () => {
    const buf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("some zip local file header bytes")]);
    const result = detectFileType(buf);
    expect(result?.isArchive).toBe(true);
    expect(result?.mimeType).toBe("application/zip");
  });

  it("distinguishes a DOCX (zip container with word/ paths) from a plain zip", () => {
    const buf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("word/document.xml rest of docx bytes")]);
    const result = detectFileType(buf);
    expect(result?.label).toMatch(/Word document/i);
  });

  it("detects gzip and rar/7z by their magic bytes", () => {
    expect(detectFileType(Buffer.from([0x1f, 0x8b, 0x08, 0x00]))?.mimeType).toBe("application/gzip");
    expect(detectFileType(Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01]))?.mimeType).toBe("application/x-rar-compressed");
    expect(detectFileType(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00]))?.mimeType).toBe("application/x-7z-compressed");
  });

  it("returns null for unrecognized content", () => {
    expect(detectFileType(Buffer.from("just plain ascii text with no known signature"))).toBeNull();
  });
});

describe("hasMacroIndicators", () => {
  it("flags a buffer containing a vbaProject.bin reference", () => {
    expect(hasMacroIndicators(Buffer.from("...word/vbaProject.bin..."))).toBe(true);
  });

  it("does not flag ordinary content", () => {
    expect(hasMacroIndicators(Buffer.from("just a normal document with no macros"))).toBe(false);
  });
});

describe("extension helpers", () => {
  it("recognizes known executable extensions case-insensitively and with/without a leading dot", () => {
    expect(isExecutableExtension("EXE")).toBe(true);
    expect(isExecutableExtension(".ps1")).toBe(true);
    expect(isExecutableExtension("txt")).toBe(false);
  });

  it("recognizes known archive extensions", () => {
    expect(isArchiveExtension("zip")).toBe(true);
    expect(isArchiveExtension("7z")).toBe(true);
    expect(isArchiveExtension("pdf")).toBe(false);
  });
});

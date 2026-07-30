import zlib from "zlib";
import { Readable } from "stream";
import yauzl from "yauzl";
import * as tar from "tar";
import { ArchiveFindings, ArchiveLimits } from "./types";
import { detectFileType, isExecutableExtension } from "./signatures";

function emptyFindings(): ArchiveFindings {
  return {
    totalEntries: 0,
    maxDepthSeen: 0,
    totalExtractedBytes: 0,
    worstCompressionRatio: 0,
    passwordProtected: false,
    corrupted: false,
    truncatedForSafety: false,
    truncationReason: null,
    nestedExecutables: [],
  };
}

function mergeFindings(target: ArchiveFindings, extra: Partial<ArchiveFindings>): void {
  if (extra.totalEntries) target.totalEntries += extra.totalEntries;
  if (extra.maxDepthSeen !== undefined) target.maxDepthSeen = Math.max(target.maxDepthSeen, extra.maxDepthSeen);
  if (extra.totalExtractedBytes) target.totalExtractedBytes += extra.totalExtractedBytes;
  if (extra.worstCompressionRatio !== undefined) target.worstCompressionRatio = Math.max(target.worstCompressionRatio, extra.worstCompressionRatio);
  if (extra.passwordProtected) target.passwordProtected = true;
  if (extra.corrupted) target.corrupted = true;
  if (extra.truncatedForSafety) {
    target.truncatedForSafety = true;
    target.truncationReason = target.truncationReason ?? extra.truncationReason ?? null;
  }
  if (extra.nestedExecutables) target.nestedExecutables.push(...extra.nestedExecutables);
}

class SafetyLimitError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

// Streams a gzip payload through zlib, aborting the moment decompressed bytes exceed `maxBytes`
// — this is the guard against a plain gzip bomb (a small file that decompresses to gigabytes),
// applied BEFORE the decompressed content is ever handed to a downstream parser (tar or a
// nested archive/file sniff).
function guardedGunzip(buffer: Buffer, maxBytes: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const chunks: Buffer[] = [];
    let total = 0;
    const timer = setTimeout(() => {
      gunzip.destroy();
      reject(new SafetyLimitError("Decompression timeout exceeded"));
    }, timeoutMs);

    gunzip.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        clearTimeout(timer);
        gunzip.destroy();
        reject(new SafetyLimitError(`Decompressed size exceeded ${maxBytes} bytes — possible decompression bomb`));
        return;
      }
      chunks.push(chunk);
    });
    gunzip.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
    gunzip.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    Readable.from(buffer).pipe(gunzip);
  });
}

async function inspectZip(buffer: Buffer, limits: ArchiveLimits, depth: number, deadline: number): Promise<ArchiveFindings> {
  const findings = emptyFindings();
  findings.maxDepthSeen = depth;

  if (depth > limits.maxDepth) {
    findings.truncatedForSafety = true;
    findings.truncationReason = `Nested archive depth exceeded ${limits.maxDepth}`;
    return findings;
  }

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        findings.corrupted = true;
        resolve(findings);
        return;
      }

      const pendingNested: Promise<void>[] = [];

      const finish = () => {
        Promise.all(pendingNested)
          .then(() => resolve(findings))
          .catch(reject);
      };

      zipfile.on("error", () => {
        findings.corrupted = true;
        finish();
      });

      zipfile.on("end", finish);

      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (Date.now() > deadline) {
          findings.truncatedForSafety = true;
          findings.truncationReason = `Archive inspection timeout exceeded ${limits.timeoutMs}ms`;
          zipfile.close();
          finish();
          return;
        }

        findings.totalEntries += 1;
        if (findings.totalEntries > limits.maxExtractedFiles) {
          findings.truncatedForSafety = true;
          findings.truncationReason = `Extracted file count exceeded ${limits.maxExtractedFiles}`;
          zipfile.close();
          finish();
          return;
        }

        // Bit 0 of the general-purpose bit flag means the entry is encrypted — detectable
        // straight from the central directory, no decompression attempt needed.
        const isEncrypted = (entry.generalPurposeBitFlag & 0x1) === 1;
        if (isEncrypted) findings.passwordProtected = true;

        const uncompressed = entry.uncompressedSize;
        const compressed = entry.compressedSize || 1;
        const ratio = uncompressed / compressed;
        findings.worstCompressionRatio = Math.max(findings.worstCompressionRatio, ratio);

        findings.totalExtractedBytes += uncompressed;
        const exceedsSize = findings.totalExtractedBytes > limits.maxExtractedSizeBytes;
        const exceedsRatio = ratio > limits.maxCompressionRatio && uncompressed > 1024 * 1024;

        if (exceedsSize || exceedsRatio) {
          findings.truncatedForSafety = true;
          findings.truncationReason = exceedsSize
            ? `Total extracted size exceeded ${limits.maxExtractedSizeBytes} bytes — possible decompression bomb`
            : `Compression ratio ${ratio.toFixed(0)}:1 exceeded ${limits.maxCompressionRatio}:1 — possible decompression bomb`;
          zipfile.close();
          finish();
          return;
        }

        const fileName = entry.fileName;
        const ext = fileName.includes(".") ? fileName.split(".").pop()! : "";
        if (isExecutableExtension(ext)) findings.nestedExecutables.push(fileName);

        const isNestedArchive = /\.(zip|jar|apk)$/i.test(fileName);
        if (isEncrypted || entry.fileName.endsWith("/") || !isNestedArchive || depth >= limits.maxDepth || uncompressed > 20 * 1024 * 1024) {
          zipfile.readEntry();
          return;
        }

        // Small nested ZIP within budget — recurse to catch e.g. an executable hidden inside
        // a zip inside a zip, up to maxDepth.
        pendingNested.push(
          new Promise<void>((res) => {
            zipfile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                res();
                zipfile.readEntry();
                return;
              }
              const chunks: Buffer[] = [];
              readStream.on("data", (c: Buffer) => chunks.push(c));
              readStream.on("end", async () => {
                try {
                  const nested = await inspectZip(Buffer.concat(chunks), limits, depth + 1, deadline);
                  mergeFindings(findings, nested);
                } catch {
                  findings.corrupted = true;
                }
                res();
                zipfile.readEntry();
              });
              readStream.on("error", () => {
                res();
                zipfile.readEntry();
              });
            });
          })
        );
      });
    });
  });
}

async function inspectTarBuffer(buffer: Buffer, limits: ArchiveLimits, depth: number, deadline: number): Promise<ArchiveFindings> {
  const findings = emptyFindings();
  findings.maxDepthSeen = depth;

  return new Promise((resolve) => {
    let aborted = false;
    const parser = new tar.Parser({
      onentry: (entry: tar.ReadEntry) => {
        if (aborted) return;
        if (Date.now() > deadline) {
          aborted = true;
          findings.truncatedForSafety = true;
          findings.truncationReason = `Archive inspection timeout exceeded ${limits.timeoutMs}ms`;
          entry.resume();
          return;
        }

        findings.totalEntries += 1;
        findings.totalExtractedBytes += entry.size ?? 0;

        if (findings.totalEntries > limits.maxExtractedFiles || findings.totalExtractedBytes > limits.maxExtractedSizeBytes) {
          aborted = true;
          findings.truncatedForSafety = true;
          findings.truncationReason =
            findings.totalEntries > limits.maxExtractedFiles
              ? `Extracted file count exceeded ${limits.maxExtractedFiles}`
              : `Total extracted size exceeded ${limits.maxExtractedSizeBytes} bytes — possible decompression bomb`;
          entry.resume();
          return;
        }

        const name = entry.path ?? "";
        const ext = name.includes(".") ? name.split(".").pop()! : "";
        if (isExecutableExtension(ext)) findings.nestedExecutables.push(name);
        entry.resume();
      },
    });

    parser.on("error", () => {
      findings.corrupted = true;
    });
    parser.on("end", () => resolve(findings));
    Readable.from(buffer).pipe(parser);
  });
}

// Top-level dispatcher: given raw bytes and the extension/type the message declared it as,
// walk the archive within the configured safety limits and report what was found. Never
// writes extracted content to disk and never executes anything — everything happens against
// in-memory buffers, discarded once this function returns.
export async function inspectArchive(
  buffer: Buffer,
  kind: "zip" | "gzip" | "tar" | "tar.gz" | "rar" | "7z",
  limits: ArchiveLimits,
  depth = 0
): Promise<ArchiveFindings> {
  const deadline = Date.now() + limits.timeoutMs;

  try {
    if (kind === "zip") {
      return await inspectZip(buffer, limits, depth, deadline);
    }
    if (kind === "tar") {
      return await inspectTarBuffer(buffer, limits, depth, deadline);
    }
    if (kind === "gzip" || kind === "tar.gz") {
      const decompressed = await guardedGunzip(buffer, limits.maxExtractedSizeBytes, limits.timeoutMs);
      if (kind === "tar.gz") {
        return await inspectTarBuffer(decompressed, limits, depth, deadline);
      }
      // Standalone .gz - treat the decompressed payload as a single inner file and sniff it;
      // recurse if it turns out to itself be an archive within the depth budget.
      const findings = emptyFindings();
      findings.maxDepthSeen = depth;
      findings.totalEntries = 1;
      findings.totalExtractedBytes = decompressed.length;
      const inner = detectFileType(decompressed);
      if (inner?.isExecutable) findings.nestedExecutables.push("(gzip payload)");
      if (inner?.isArchive && depth < limits.maxDepth) {
        const nested = await inspectArchive(decompressed, "zip", limits, depth + 1);
        mergeFindings(findings, nested);
      }
      return findings;
    }
    // RAR/7Z are proprietary formats this app has no reason to implement a decoder for.
    // Always routed to the configurable "cannot safely inspect" path rather than guessed at.
    const findings = emptyFindings();
    findings.truncatedForSafety = true;
    findings.truncationReason = `${kind.toUpperCase()} archives cannot be inspected — no decoder implemented`;
    return findings;
  } catch (err) {
    const findings = emptyFindings();
    if (err instanceof SafetyLimitError) {
      findings.truncatedForSafety = true;
      findings.truncationReason = err.reason;
    } else {
      findings.corrupted = true;
    }
    return findings;
  }
}

import crypto from "crypto";
import { ArchiveLimits, FileCharacteristics, FileInspectionResult } from "./types";
import { detectFileType, hasMacroIndicators, isArchiveExtension, isExecutableExtension } from "./signatures";
import { inspectArchive } from "./archiveInspection";

const KNOWN_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "dll", "ps1", "vbs", "js", "jar", "apk", "iso", "img",
  "zip", "rar", "7z", "tar", "gz", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "png", "jpg", "jpeg", "gif", "mp3", "mp4", "sql", "db", "py", "sh", "rb", "php",
]);

function splitNameAndExtensions(fileName: string): { base: string; extensions: string[] } {
  const parts = fileName.split(".");
  if (parts.length <= 1) return { base: fileName, extensions: [] };
  const [base, ...rest] = parts;
  return { base, extensions: rest };
}

function detectArchiveKind(fileName: string, detected: ReturnType<typeof detectFileType>): "zip" | "gzip" | "tar" | "tar.gz" | "rar" | "7z" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "tar.gz";
  if (lower.endsWith(".tar")) return "tar";
  if (lower.endsWith(".gz")) return "gzip";
  if (lower.endsWith(".rar") || detected?.mimeType === "application/x-rar-compressed") return "rar";
  if (lower.endsWith(".7z") || detected?.mimeType === "application/x-7z-compressed") return "7z";
  if (detected?.isArchive) return "zip";
  if (lower.endsWith(".zip") || lower.endsWith(".jar") || lower.endsWith(".apk")) return "zip";
  return null;
}

// The core, provider-agnostic inspection entry point: given a file's declared name and its
// raw bytes, determine what it actually is (never trusting the extension alone), walk it as
// an archive if it is one, and report every characteristic the Mail File Blocking policy
// engine needs to evaluate rules against. Never executes, opens, or renders the content.
export async function inspectFile(fileName: string, buffer: Buffer, archiveLimits: ArchiveLimits): Promise<FileInspectionResult> {
  const { base, extensions } = splitNameAndExtensions(fileName);
  const declaredExtension = extensions.length > 0 ? extensions[extensions.length - 1].toLowerCase() : null;
  const detected = detectFileType(buffer);

  const characteristics: FileCharacteristics = {
    passwordProtected: false,
    corrupted: false,
    doubleExtension: extensions.length >= 2 && isExecutableExtension(extensions[extensions.length - 1]) && KNOWN_EXTENSIONS.has(extensions[0].toLowerCase()),
    hiddenExtension: base.length === 0 && extensions.length >= 1,
    noExtension: extensions.length === 0,
    embeddedFiles: false,
    macroEnabled: false,
    executableContent: detected?.isExecutable === true || (declaredExtension !== null && isExecutableExtension(declaredExtension)),
  };

  const extensionMismatch =
    declaredExtension !== null &&
    detected !== null &&
    isExecutableExtension(declaredExtension) !== detected.isExecutable &&
    (detected.isExecutable || isExecutableExtension(declaredExtension));

  let uninspectableReason: string | null = null;
  let archiveFindings: FileInspectionResult["archiveFindings"];

  const archiveKind = detectArchiveKind(fileName, detected);
  const looksLikeArchive = archiveKind !== null || (declaredExtension !== null && isArchiveExtension(declaredExtension));

  if (looksLikeArchive) {
    const kind = archiveKind ?? "zip";
    archiveFindings = await inspectArchive(buffer, kind, archiveLimits);
    characteristics.passwordProtected = archiveFindings.passwordProtected;
    characteristics.corrupted = archiveFindings.corrupted;
    characteristics.embeddedFiles = archiveFindings.totalEntries > 0;
    characteristics.executableContent = characteristics.executableContent || archiveFindings.nestedExecutables.length > 0;

    if (archiveFindings.truncatedForSafety) {
      uninspectableReason = archiveFindings.truncationReason ?? "Archive could not be safely inspected";
    } else if (archiveFindings.passwordProtected) {
      uninspectableReason = "Password-protected archive";
    } else if (archiveFindings.corrupted) {
      uninspectableReason = "Corrupted archive";
    }
  } else if (detected && /officedocument|ole-storage/.test(detected.mimeType)) {
    characteristics.macroEnabled = hasMacroIndicators(buffer);
  }

  return {
    fileName,
    declaredExtension,
    detectedMimeType: detected?.mimeType ?? null,
    detectedFileType: detected?.label ?? null,
    sizeBytes: buffer.length,
    hash: crypto.createHash("sha256").update(buffer).digest("hex"),
    characteristics,
    extensionMismatch,
    uninspectableReason,
    archiveFindings,
  };
}

// Hand-rolled magic-byte signature table rather than pulling in a package like `file-type`
// (ESM-only in current majors, awkward with this app's tsx/CJS-friendly build) — this app's
// established preference is hand-rolled logic over a heavy dependency when the surface is
// bounded (see notifyEmail.ts's raw-socket SMTP client instead of nodemailer). The list below
// covers exactly the categories the Mail File Blocking spec calls out: executables, archives,
// disk images, and common office/media documents.

export interface FileTypeDetection {
  mimeType: string;
  label: string;
  isArchive: boolean;
  isExecutable: boolean;
}

interface Signature {
  bytes: number[];
  offset: number;
  detect: FileTypeDetection;
}

const SIGNATURES: Signature[] = [
  { offset: 0, bytes: [0x4d, 0x5a], detect: { mimeType: "application/x-msdownload", label: "Windows executable (PE/EXE)", isArchive: false, isExecutable: true } },
  { offset: 0, bytes: [0x7f, 0x45, 0x4c, 0x46], detect: { mimeType: "application/x-executable", label: "Linux executable (ELF)", isArchive: false, isExecutable: true } },
  { offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04], detect: { mimeType: "application/zip", label: "ZIP archive (or ZIP-based container)", isArchive: true, isExecutable: false } },
  { offset: 0, bytes: [0x50, 0x4b, 0x05, 0x06], detect: { mimeType: "application/zip", label: "ZIP archive (empty)", isArchive: true, isExecutable: false } },
  { offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], detect: { mimeType: "application/x-ole-storage", label: "Legacy Office document (OLE compound file)", isArchive: false, isExecutable: false } },
  { offset: 0, bytes: [0x25, 0x50, 0x44, 0x46], detect: { mimeType: "application/pdf", label: "PDF document", isArchive: false, isExecutable: false } },
  { offset: 0, bytes: [0x1f, 0x8b], detect: { mimeType: "application/gzip", label: "GZIP archive", isArchive: true, isExecutable: false } },
  { offset: 0, bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], detect: { mimeType: "application/x-rar-compressed", label: "RAR archive", isArchive: true, isExecutable: false } },
  { offset: 0, bytes: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], detect: { mimeType: "application/x-7z-compressed", label: "7-Zip archive", isArchive: true, isExecutable: false } },
  { offset: 0x8001, bytes: [0x43, 0x44, 0x30, 0x30, 0x31], detect: { mimeType: "application/x-iso9660-image", label: "ISO disk image", isArchive: false, isExecutable: false } },
  { offset: 0, bytes: [0xff, 0xd8, 0xff], detect: { mimeType: "image/jpeg", label: "JPEG image", isArchive: false, isExecutable: false } },
  { offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], detect: { mimeType: "image/png", label: "PNG image", isArchive: false, isExecutable: false } },
  { offset: 0, bytes: [0x47, 0x49, 0x46, 0x38], detect: { mimeType: "image/gif", label: "GIF image", isArchive: false, isExecutable: false } },
];

function matchesAt(buffer: Buffer, sig: Signature): boolean {
  if (buffer.length < sig.offset + sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    if (buffer[sig.offset + i] !== sig.bytes[i]) return false;
  }
  return true;
}

// Internal-path sniffing to tell ZIP-based Office/Java/Android containers apart from a plain
// ZIP archive, since they all share the PK\x03\x04 signature. Cheap string search over the
// first chunk of raw bytes is enough — no need to actually parse the ZIP central directory
// just to distinguish these (archiveInspection.ts does the real structured parse when the
// content is actually treated as an archive).
function refineZipContainer(buffer: Buffer): FileTypeDetection | null {
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("latin1");
  if (head.includes("word/")) return { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word document (DOCX)", isArchive: true, isExecutable: false };
  if (head.includes("xl/")) return { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel spreadsheet (XLSX)", isArchive: true, isExecutable: false };
  if (head.includes("ppt/")) return { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", label: "PowerPoint presentation (PPTX)", isArchive: true, isExecutable: false };
  if (head.includes("AndroidManifest.xml")) return { mimeType: "application/vnd.android.package-archive", label: "Android package (APK)", isArchive: true, isExecutable: true };
  if (head.includes("META-INF/MANIFEST.MF")) return { mimeType: "application/java-archive", label: "Java archive (JAR)", isArchive: true, isExecutable: true };
  return null;
}

export function detectFileType(buffer: Buffer): FileTypeDetection | null {
  for (const sig of SIGNATURES) {
    if (matchesAt(buffer, sig)) {
      if (sig.detect.mimeType === "application/zip") {
        const refined = refineZipContainer(buffer);
        if (refined) return refined;
      }
      return sig.detect;
    }
  }
  return null;
}

// Presence of a vbaProject.bin part (OOXML macro-enabled documents) or the OLE compound
// "Macros" storage (legacy .doc/.xls/.ppt) — cheap substring probe, same rationale as
// refineZipContainer above (a full parse isn't needed just to flag the possibility).
export function hasMacroIndicators(buffer: Buffer): boolean {
  const head = buffer.subarray(0, Math.min(buffer.length, 65536)).toString("latin1");
  return head.includes("vbaProject.bin") || head.includes("Macros") || head.includes("VBA");
}

const EXECUTABLE_EXTENSIONS = new Set([
  "exe", "msi", "bat", "cmd", "com", "scr", "dll", "ps1", "vbs", "js", "jar", "apk",
]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "rar", "7z", "tar", "gz", "iso", "img"]);

export function isExecutableExtension(ext: string): boolean {
  return EXECUTABLE_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ""));
}

export function isArchiveExtension(ext: string): boolean {
  return ARCHIVE_EXTENSIONS.has(ext.toLowerCase().replace(/^\./, ""));
}

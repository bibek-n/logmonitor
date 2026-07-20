import path from "path";
import fs from "fs";

// Shared across every module that reads arbitrary files off disk (Code Quality, Laravel
// Security, and future modules) - the source path a project points at must be constrained to
// an explicit allowlist of roots, never a repository URL cloned over the network (no git
// binary, no credential handling, far smaller attack surface). Roots come from
// REPO_SCAN_ROOTS (semicolon-separated, since Windows paths contain colons); the older
// CODE_QUALITY_SCAN_ROOTS name is still honored for anyone who configured it before this
// module became shared, and default to this app's own directory so a module has a real,
// immediately scannable target out of the box instead of needing extra setup before it can
// produce non-mock results.
// Exported so folderBrowser.ts can list/navigate within exactly the same allowlist this
// module uses to validate a project's SourcePath - one source of truth for "what's approved,"
// never a second copy that could drift out of sync with this one.
export function getAllowedRoots(): string[] {
  const configured = process.env.REPO_SCAN_ROOTS ?? process.env.CODE_QUALITY_SCAN_ROOTS;
  const raw = configured && configured.trim() ? configured.split(";") : [process.cwd()];
  return raw
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      try {
        return fs.realpathSync(path.resolve(p));
      } catch {
        return path.resolve(p);
      }
    });
}

export function isWithinRoot(candidate: string, root: string): boolean {
  if (candidate === root) return true;
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  return candidate.toLowerCase().startsWith(rootWithSep.toLowerCase());
}

export interface PathValidationResult {
  ok: boolean;
  resolvedPath: string;
  error?: string;
}

// Resolves `.` / `..` segments AND the real filesystem path (so a symlink pointing outside
// every allowed root can't be used to escape the allowlist), then checks the result sits
// inside at least one configured root. Called before every filesystem read a scan performs -
// on the project's SourcePath when a scan starts, never trusted from a prior scan's cached
// value.
export function validateSourcePath(sourcePath: string): PathValidationResult {
  if (!sourcePath || typeof sourcePath !== "string" || !sourcePath.trim()) {
    return { ok: false, resolvedPath: "", error: "Source path is required." };
  }

  const resolved = path.resolve(sourcePath);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    return { ok: false, resolvedPath: resolved, error: "Source path does not exist." };
  }
  if (!stat.isDirectory()) {
    return { ok: false, resolvedPath: resolved, error: "Source path must be a directory." };
  }

  let realPath: string;
  try {
    realPath = fs.realpathSync(resolved);
  } catch {
    return { ok: false, resolvedPath: resolved, error: "Source path could not be resolved." };
  }

  const roots = getAllowedRoots();
  const allowed = roots.some((root) => isWithinRoot(realPath, root));
  if (!allowed) {
    return {
      ok: false,
      resolvedPath: realPath,
      error: "Source path is outside the approved scan roots. Set REPO_SCAN_ROOTS to allow it.",
    };
  }

  return { ok: true, resolvedPath: realPath };
}

import fs from "fs";
import path from "path";
import { getAllowedRoots, isWithinRoot } from "./pathSecurity";

export interface FolderEntry {
  name: string;
  path: string;
}

export interface FolderListing {
  currentPath: string | null; // null = the top-level "pick an allowed root" listing
  parentPath: string | null; // null when there's nowhere to go up to (at a root, or top-level)
  entries: FolderEntry[];
}

// Directories that are near-certain noise for "pick a project's source folder" and clutter
// every listing if shown - deliberately NOT excluded from being scanned later (fileWalker.ts's
// own excludedDirectories setting handles that); this only hides them from the picker UI.
const HIDDEN_NAMES = new Set(["node_modules", ".git", ".next", "dist", "build", ".venv", "__pycache__"]);

function listSubdirectories(absoluteDir: string): FolderEntry[] {
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return dirents
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !HIDDEN_NAMES.has(d.name))
    .map((d) => ({ name: d.name, path: path.join(absoluteDir, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// requestedPath === null lists the configured allowed roots themselves, as starting points -
// there's no single "top" directory to browse from otherwise (CODE_QUALITY_SCAN_ROOTS can name
// several unrelated roots). Any other value is resolved to its real path and checked against
// the same allowlist validateSourcePath() itself enforces, so this can never be used to browse
// (or even learn the existence of) anything outside approved scan roots.
export function browseFolder(requestedPath: string | null): { ok: true; data: FolderListing } | { ok: false; error: string } {
  const roots = getAllowedRoots();

  if (!requestedPath || !requestedPath.trim()) {
    return {
      ok: true,
      data: { currentPath: null, parentPath: null, entries: roots.map((r) => ({ name: r, path: r })) },
    };
  }

  const resolved = path.resolve(requestedPath);
  let realPath: string;
  try {
    realPath = fs.realpathSync(resolved);
  } catch {
    return { ok: false, error: "Folder does not exist." };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(realPath);
  } catch {
    return { ok: false, error: "Folder does not exist." };
  }
  if (!stat.isDirectory()) {
    return { ok: false, error: "Path is not a directory." };
  }

  const matchedRoot = roots.find((r) => isWithinRoot(realPath, r));
  if (!matchedRoot) {
    return { ok: false, error: "Folder is outside the approved scan roots." };
  }

  // Never let "up" navigate above the matched root - the parent list stops exactly at the
  // top-level roots listing instead.
  const parentPath = realPath === matchedRoot ? null : path.dirname(realPath);

  return {
    ok: true,
    data: { currentPath: realPath, parentPath, entries: listSubdirectories(realPath) },
  };
}

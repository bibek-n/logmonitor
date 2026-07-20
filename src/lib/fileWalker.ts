import path from "path";
import fs from "fs/promises";

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  sizeBytes: number;
}

export interface WalkOptions {
  excludedDirectories: string[];
  allowedExtensions: string[];
  maxTotalBytes: number;
}

// Async-generator directory walk so a scan can process one file at a time (read, analyze,
// discard) instead of collecting the whole repository's file list/contents in memory first -
// required for "process files incrementally" / "avoid loading an entire repository into
// memory" on repos that could be tens of thousands of files. Symlinked entries are skipped
// outright (never followed) rather than resolved, since a symlink inside an already-approved
// root could still point somewhere outside it.
export async function* walkSourceFiles(rootPath: string, opts: WalkOptions): AsyncGenerator<WalkedFile> {
  const excluded = new Set(opts.excludedDirectories.map((d) => d.toLowerCase()));
  const extensions = new Set(opts.allowedExtensions.map((e) => (e.startsWith(".") ? e : `.${e}`).toLowerCase()));
  let totalBytes = 0;

  async function* walk(dir: string): AsyncGenerator<WalkedFile> {
    let entries: import("fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory (permissions, race with deletion) - skip, don't fail the whole scan
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;

      const absolutePath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (excluded.has(entry.name.toLowerCase())) continue;
        yield* walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.has(ext)) continue;

      let sizeBytes = 0;
      try {
        sizeBytes = (await fs.stat(absolutePath)).size;
      } catch {
        continue; // race with deletion between readdir and stat - skip
      }

      totalBytes += sizeBytes;
      if (totalBytes > opts.maxTotalBytes) {
        throw new Error(
          `Scan exceeded the configured maximum size (${Math.round(opts.maxTotalBytes / (1024 * 1024))} MB). Narrow the included directories or raise MaxScanSizeMb in Settings.`
        );
      }

      yield { absolutePath, relativePath: path.relative(rootPath, absolutePath), sizeBytes };
    }
  }

  yield* walk(rootPath);
}

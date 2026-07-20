import fs from "fs/promises";
import path from "path";
import type { SourceFile } from "./types";

// Several checks (AppDebug/AppKey/DotEnv/StorageLinks/Queue) target specific, well-known
// root-relative files (.env, config/app.php, .gitignore, ...) rather than an arbitrary set of
// walked source files - fileWalker.ts's extname()-based extension matching structurally can't
// pick up dotfiles like .env (path.extname('.env') === ''), so these are read directly instead
// of being routed through the generic walk. Returns null for a missing/unreadable file - "the
// file doesn't exist" is itself meaningful to several checks (e.g. no .env at all just means
// nothing to flag), not an error.
export async function readOptionalFile(rootPath: string, relativePath: string): Promise<SourceFile | null> {
  const absolutePath = path.join(rootPath, relativePath);
  try {
    const buffer = await fs.readFile(absolutePath);
    if (buffer.includes(0)) return null; // binary file masquerading under this name
    const content = buffer.toString("utf8");
    return { absolutePath, relativePath, content, lines: content.split(/\r\n|\r|\n/) };
  } catch {
    return null;
  }
}

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

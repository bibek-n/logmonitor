import fs from "fs/promises";
import path from "path";

export interface LaravelDetectionResult {
  isLaravel: boolean;
  laravelVersion: string | null;
  reason: string;
}

// Best-effort detection only - used to annotate the scan log and the project's LaravelVersion
// column, never to block a scan. A false negative (misdetected as "not Laravel") still runs
// every check normally; the checks are file-pattern based and simply won't find anything to
// flag in a non-Laravel codebase.
export async function detectLaravel(rootPath: string): Promise<LaravelDetectionResult> {
  const composerPath = path.join(rootPath, "composer.json");
  let composerJson: { require?: Record<string, string> } | null = null;
  try {
    const raw = await fs.readFile(composerPath, "utf8");
    composerJson = JSON.parse(raw);
  } catch {
    composerJson = null;
  }

  const laravelConstraint = composerJson?.require?.["laravel/framework"];
  if (laravelConstraint) {
    return { isLaravel: true, laravelVersion: laravelConstraint, reason: `composer.json requires laravel/framework ${laravelConstraint}.` };
  }

  try {
    await fs.access(path.join(rootPath, "artisan"));
    return { isLaravel: true, laravelVersion: null, reason: "An 'artisan' file is present at the project root." };
  } catch {
    // fall through
  }

  return { isLaravel: false, laravelVersion: null, reason: "No composer.json requiring laravel/framework and no artisan file were found - checks will still run, but may find little or nothing to report." };
}

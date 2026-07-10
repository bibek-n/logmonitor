import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

const LOG_DIR = path.join(process.cwd(), "iisnode");
const MAX_LINES = 300;

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  try {
    const entries = await fs.readdir(LOG_DIR);
    const logFiles = entries.filter((f) => f.endsWith(".txt"));
    if (logFiles.length === 0) {
      return NextResponse.json({ ok: true, data: { fileName: null, lines: [] } });
    }

    const withStats = await Promise.all(
      logFiles.map(async (f) => ({ name: f, stat: await fs.stat(path.join(LOG_DIR, f)) }))
    );
    withStats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
    const latest = withStats[0].name;

    const content = await fs.readFile(path.join(LOG_DIR, latest), "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean).slice(-MAX_LINES);

    return NextResponse.json({ ok: true, data: { fileName: latest, lines } });
  } catch {
    return NextResponse.json({ ok: true, data: { fileName: null, lines: [] } });
  }
}

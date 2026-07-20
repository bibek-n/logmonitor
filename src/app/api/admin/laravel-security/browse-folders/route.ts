import { NextRequest, NextResponse } from "next/server";
import { requireLaravelSecurityPermission, isLsSession } from "@/lib/requireLaravelSecurityPermission";
import { browseFolder } from "@/lib/folderBrowser";

export async function GET(req: NextRequest) {
  const ls = await requireLaravelSecurityPermission("ls_view");
  if (!isLsSession(ls)) return ls;

  const requestedPath = req.nextUrl.searchParams.get("path");
  const result = browseFolder(requestedPath);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, data: result.data });
}

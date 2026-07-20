import { NextRequest, NextResponse } from "next/server";
import { requireCodeQualityPermission, isCqSession } from "@/lib/requireCodeQualityPermission";
import { browseFolder } from "@/lib/folderBrowser";

export async function GET(req: NextRequest) {
  const cq = await requireCodeQualityPermission("cq_view");
  if (!isCqSession(cq)) return cq;

  const requestedPath = req.nextUrl.searchParams.get("path");
  const result = browseFolder(requestedPath);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, data: result.data });
}

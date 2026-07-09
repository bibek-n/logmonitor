import { NextRequest, NextResponse } from "next/server";
import { isValidUrl, websiteHealthCheck } from "@/lib/websiteTools";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (typeof url !== "string" || !isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: "Invalid URL — must start with http:// or https://" }, { status: 400 });
  }

  const output = await websiteHealthCheck(url);
  return NextResponse.json({ ok: true, output });
}

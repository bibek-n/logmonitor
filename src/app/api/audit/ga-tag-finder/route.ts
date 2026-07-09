import { NextRequest, NextResponse } from "next/server";
import { isValidUrl, gaTagFinder } from "@/lib/websiteTools";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (typeof url !== "string" || !isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: "Invalid URL — must start with http:// or https://" }, { status: 400 });
  }

  try {
    const output = await gaTagFinder(url);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Request failed" }, { status: 500 });
  }
}

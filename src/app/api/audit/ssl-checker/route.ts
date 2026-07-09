import { NextRequest, NextResponse } from "next/server";
import { isValidUrl, sslCertCheck } from "@/lib/websiteTools";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (typeof url !== "string" || !isValidUrl(url)) {
    return NextResponse.json({ ok: false, error: "Invalid URL — must start with http:// or https://" }, { status: 400 });
  }

  try {
    const output = await sslCertCheck(url);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Certificate check failed" }, { status: 500 });
  }
}

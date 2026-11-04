import { NextRequest, NextResponse } from "next/server";
import { checkRedirectChain } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (typeof target !== "string" || target.trim().length === 0 || target.length > 2048) {
    return NextResponse.json({ ok: false, error: "Enter a URL to check." }, { status: 400 });
  }

  try {
    const output = await checkRedirectChain(target.trim());
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Request failed." }, { status: 400 });
  }
}

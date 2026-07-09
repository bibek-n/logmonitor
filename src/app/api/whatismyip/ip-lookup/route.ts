import { NextRequest, NextResponse } from "next/server";
import { isValidIpOrDomain, ipLookup } from "@/lib/ipTools";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (typeof target !== "string" || !isValidIpOrDomain(target)) {
    return NextResponse.json({ ok: false, error: "Invalid IP address or hostname." }, { status: 400 });
  }

  try {
    const output = await ipLookup(target);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}

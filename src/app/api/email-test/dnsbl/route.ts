import { NextRequest, NextResponse } from "next/server";
import { isValidIpv4, dnsblLookup } from "@/lib/emailTools";

export async function POST(req: NextRequest) {
  const { ip } = await req.json();
  if (typeof ip !== "string" || !isValidIpv4(ip)) {
    return NextResponse.json({ ok: false, error: "Invalid IP address — DNSBL lookups require an IPv4 address." }, { status: 400 });
  }

  const output = await dnsblLookup(ip);
  return NextResponse.json({ ok: true, output });
}

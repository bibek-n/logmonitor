import { NextRequest, NextResponse } from "next/server";
import { isValidIp, blacklistCheck } from "@/lib/ipTools";

export async function POST(req: NextRequest) {
  const { ip } = await req.json();
  if (typeof ip !== "string" || !isValidIp(ip) || ip.includes(":")) {
    return NextResponse.json({ ok: false, error: "Invalid IPv4 address." }, { status: 400 });
  }

  const output = await blacklistCheck(ip);
  return NextResponse.json({ ok: true, output });
}

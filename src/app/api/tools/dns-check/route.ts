import { NextRequest, NextResponse } from "next/server";
import { isValidTarget, dnsCheck } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (typeof target !== "string" || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }

  const output = await dnsCheck(target);
  return NextResponse.json({ ok: true, output });
}

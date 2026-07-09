import { NextRequest, NextResponse } from "next/server";
import { isValidTarget, hostLookup } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (typeof target !== "string" || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid target — use an IP address or hostname." }, { status: 400 });
  }

  const output = await hostLookup(target);
  return NextResponse.json({ ok: true, output });
}

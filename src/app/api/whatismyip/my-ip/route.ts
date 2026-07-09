import { NextResponse } from "next/server";
import { myIpInfo } from "@/lib/ipTools";

export async function POST() {
  try {
    const output = await myIpInfo();
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}

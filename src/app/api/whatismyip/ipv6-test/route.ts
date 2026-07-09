import { NextResponse } from "next/server";
import { ipv6Test } from "@/lib/ipTools";

export async function POST() {
  const output = await ipv6Test();
  return NextResponse.json({ ok: true, output });
}

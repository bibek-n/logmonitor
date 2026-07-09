import { NextRequest, NextResponse } from "next/server";
import { isValidTarget, reverseDns } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target } = await req.json();
  if (typeof target !== "string" || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid target — use an IP address." }, { status: 400 });
  }

  try {
    const output = await reverseDns(target);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Lookup failed" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isValidTarget, nslookup, NSLOOKUP_RECORD_TYPES } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target, recordType, server } = await req.json();
  if (typeof target !== "string" || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid target — use an IP address or hostname." }, { status: 400 });
  }
  if (typeof recordType !== "string" || !NSLOOKUP_RECORD_TYPES.includes(recordType)) {
    return NextResponse.json({ ok: false, error: "Invalid record type." }, { status: 400 });
  }
  if (server !== undefined && server !== "" && (typeof server !== "string" || !isValidTarget(server))) {
    return NextResponse.json({ ok: false, error: "Invalid DNS server address." }, { status: 400 });
  }

  try {
    const output = await nslookup(target, recordType, server || undefined);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Lookup failed" }, { status: 500 });
  }
}

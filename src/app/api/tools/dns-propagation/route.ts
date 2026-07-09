import { NextRequest, NextResponse } from "next/server";
import { isValidTarget, dnsPropagationCheck, NSLOOKUP_RECORD_TYPES } from "@/lib/networkTools";

export async function POST(req: NextRequest) {
  const { target, recordType } = await req.json();
  if (typeof target !== "string" || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }
  const type = typeof recordType === "string" && NSLOOKUP_RECORD_TYPES.includes(recordType) ? recordType : "A";

  const output = await dnsPropagationCheck(target, type);
  return NextResponse.json({ ok: true, output });
}

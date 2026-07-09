import { NextRequest, NextResponse } from "next/server";
import { isValidHost, uriblLookup } from "@/lib/emailTools";

export async function POST(req: NextRequest) {
  const { domain } = await req.json();
  if (typeof domain !== "string" || !isValidHost(domain)) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }

  const output = await uriblLookup(domain);
  return NextResponse.json({ ok: true, output });
}

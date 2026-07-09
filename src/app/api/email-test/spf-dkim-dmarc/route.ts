import { NextRequest, NextResponse } from "next/server";
import { isValidHost, spfDkimDmarcCheck } from "@/lib/emailTools";

const SELECTOR_RE = /^[a-zA-Z0-9_-]{1,63}$/;

export async function POST(req: NextRequest) {
  const { domain, dkimSelector } = await req.json();
  if (typeof domain !== "string" || !isValidHost(domain)) {
    return NextResponse.json({ ok: false, error: "Invalid domain." }, { status: 400 });
  }
  if (dkimSelector && (typeof dkimSelector !== "string" || !SELECTOR_RE.test(dkimSelector))) {
    return NextResponse.json({ ok: false, error: "Invalid DKIM selector." }, { status: 400 });
  }

  const output = await spfDkimDmarcCheck(domain, dkimSelector || undefined);
  return NextResponse.json({ ok: true, output });
}

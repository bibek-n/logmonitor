import { NextRequest, NextResponse } from "next/server";
import { isValidHost, smtpServerTest } from "@/lib/emailTools";

export async function POST(req: NextRequest) {
  const { host, port } = await req.json();
  if (typeof host !== "string" || !isValidHost(host)) {
    return NextResponse.json({ ok: false, error: "Invalid SMTP host." }, { status: 400 });
  }
  const portNum = Number(port) || 25;
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return NextResponse.json({ ok: false, error: "Invalid port." }, { status: 400 });
  }

  try {
    const output = await smtpServerTest(host, portNum);
    return NextResponse.json({ ok: true, output });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" }, { status: 500 });
  }
}

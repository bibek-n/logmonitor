import { NextRequest, NextResponse } from "next/server";
import { isValidHost, emailDeliveryTest } from "@/lib/emailTools";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const { smtpHost, smtpPort, username, password, from, to } = await req.json();

  if (typeof smtpHost !== "string" || !isValidHost(smtpHost)) {
    return NextResponse.json({ ok: false, error: "Invalid SMTP host." }, { status: 400 });
  }
  const portNum = Number(smtpPort) || 587;
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    return NextResponse.json({ ok: false, error: "Invalid port." }, { status: 400 });
  }
  if (typeof username !== "string" || !username) {
    return NextResponse.json({ ok: false, error: "Username is required." }, { status: 400 });
  }
  if (typeof password !== "string" || !password) {
    return NextResponse.json({ ok: false, error: "Password is required." }, { status: 400 });
  }
  if (typeof from !== "string" || !EMAIL_RE.test(from)) {
    return NextResponse.json({ ok: false, error: "Invalid 'From' address." }, { status: 400 });
  }
  if (typeof to !== "string" || !EMAIL_RE.test(to)) {
    return NextResponse.json({ ok: false, error: "Invalid 'To' address." }, { status: 400 });
  }

  const output = await emailDeliveryTest({ smtpHost, smtpPort: portNum, username, password, from, to });
  return NextResponse.json({ ok: true, output });
}

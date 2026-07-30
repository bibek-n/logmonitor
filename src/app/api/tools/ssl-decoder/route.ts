import { NextRequest, NextResponse } from "next/server";
import { decodeCertificate, formatDecodedCertificate } from "@/lib/utilities/sslDecoder";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const pem = typeof body?.pem === "string" ? body.pem.trim() : "";

  if (!pem || !pem.includes("BEGIN CERTIFICATE")) {
    return NextResponse.json(
      { ok: false, error: "Paste a PEM-encoded certificate (starting with -----BEGIN CERTIFICATE-----)." },
      { status: 400 }
    );
  }

  try {
    const cert = decodeCertificate(pem);
    return NextResponse.json({ ok: true, output: formatDecodedCertificate(cert) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to decode certificate." }, { status: 400 });
  }
}

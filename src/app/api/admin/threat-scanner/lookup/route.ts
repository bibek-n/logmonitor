import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";
import { runLookup } from "@/lib/threatScanner/runScan";

const HASH_RE = /^[a-fA-F0-9]{32}$|^[a-fA-F0-9]{40}$|^[a-fA-F0-9]{64}$/; // MD5 / SHA-1 / SHA-256
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const DOMAIN_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))+$/;

function detectKind(value: string): "Hash" | "Ip" | "Domain" | null {
  if (HASH_RE.test(value)) return "Hash";
  if (IPV4_RE.test(value)) return "Ip";
  if (DOMAIN_RE.test(value)) return "Domain";
  return null;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  const value = typeof body?.value === "string" ? body.value.trim() : "";
  if (!value) return NextResponse.json({ ok: false, error: "A file hash, IP address, or domain is required." });

  const kind = detectKind(value);
  if (!kind) {
    return NextResponse.json({ ok: false, error: "Not a recognized MD5/SHA-1/SHA-256 hash, IPv4 address, or domain name." });
  }

  const scanId = await runLookup({ kind, value, triggeredByUserId: admin.userId, triggeredByUsername: admin.username });
  await logAdminAction({ admin, section: "threat-scanner", action: "lookup", details: `${kind}: ${value}`, req });

  return NextResponse.json({ ok: true, scanId });
}

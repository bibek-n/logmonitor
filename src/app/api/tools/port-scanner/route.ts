import { NextRequest, NextResponse } from "next/server";
import { isValidTarget } from "@/lib/networkTools";
import {
  parsePortSpec,
  runPortScan,
  formatScanResults,
  TOP_20_TCP_PORTS,
  COMMON_TCP_PORTS,
  COMMON_UDP_PORTS,
  type ScanProtocol,
} from "@/lib/portScanner";

const VALID_PROTOCOLS: ScanProtocol[] = ["tcp", "udp"];
const VALID_PRESETS = ["top20", "common", "custom"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const target = typeof body?.target === "string" ? body.target.trim() : "";
  const category = body?.category === "external" ? "external" : "internal";
  const protocol: ScanProtocol = VALID_PROTOCOLS.includes(body?.protocol) ? body.protocol : "tcp";
  const preset = VALID_PRESETS.includes(body?.preset) ? body.preset : "top20";
  const grabBanners = body?.grabBanners === true && protocol === "tcp";

  if (!target || !isValidTarget(target)) {
    return NextResponse.json({ ok: false, error: "Invalid target — use an IP address or hostname." }, { status: 400 });
  }

  let ports: number[];
  try {
    if (preset === "custom") {
      const customSpec = typeof body?.customPorts === "string" ? body.customPorts.trim() : "";
      if (!customSpec) throw new Error("Custom port list/range is required.");
      ports = parsePortSpec(customSpec);
    } else if (preset === "top20") {
      ports = TOP_20_TCP_PORTS;
    } else {
      ports = protocol === "tcp" ? COMMON_TCP_PORTS : COMMON_UDP_PORTS;
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Invalid port specification." }, { status: 400 });
  }

  const startedAt = Date.now();
  const results = await runPortScan(target, { protocol, ports, grabBanners });
  const output = formatScanResults(target, category, results, Date.now() - startedAt);

  return NextResponse.json({ ok: true, output });
}

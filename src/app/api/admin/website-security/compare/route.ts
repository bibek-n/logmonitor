import { NextRequest, NextResponse } from "next/server";
import { requireWebsiteSecurityPermission, isWebsiteSecuritySession } from "@/lib/requireWebsiteSecurityPermission";
import { loadScanDetail } from "@/lib/websiteSecurityAudit/scanDetail";
import type { CodeFinding, DependencyFinding, Finding } from "@/lib/websiteSecurityAudit/types";

interface DiffEntry<T> {
  key: string;
  item: T;
}

function diffByKey<T>(older: DiffEntry<T>[], newer: DiffEntry<T>[]) {
  const olderKeys = new Set(older.map((e) => e.key));
  const newerKeys = new Set(newer.map((e) => e.key));
  return {
    added: newer.filter((e) => !olderKeys.has(e.key)).map((e) => e.item),
    fixed: older.filter((e) => !newerKeys.has(e.key)).map((e) => e.item),
    persisting: newer.filter((e) => olderKeys.has(e.key)).map((e) => e.item),
  };
}

// Findings carry no stable id across scans (each scan re-inserts fresh rows), so "same issue"
// is identified by category+title (findings/code) or package+ecosystem (dependencies) -
// stable enough in practice since both are derived from the check/package itself, not from
// anything scan-run-specific like a timestamp or row id.
export async function GET(req: NextRequest) {
  const admin = await requireWebsiteSecurityPermission("wsa_view");
  if (!isWebsiteSecuritySession(admin)) return admin;

  const { searchParams } = new URL(req.url);
  const scanIdA = Number(searchParams.get("a"));
  const scanIdB = Number(searchParams.get("b"));
  if (!Number.isInteger(scanIdA) || !Number.isInteger(scanIdB) || scanIdA <= 0 || scanIdB <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid scan ids" }, { status: 400 });
  }

  const [detailA, detailB] = await Promise.all([loadScanDetail(scanIdA), loadScanDetail(scanIdB)]);
  if (!detailA || !detailB) {
    return NextResponse.json({ ok: false, error: "One or both scans could not be loaded" }, { status: 404 });
  }
  if (detailA.websiteId !== detailB.websiteId) {
    return NextResponse.json({ ok: false, error: "Scans belong to different websites" }, { status: 400 });
  }

  // Always compare chronologically (older -> newer) regardless of the order the two ids were
  // passed in, so "added"/"fixed" always mean the same thing to the caller.
  const [older, newer] = new Date(detailA.scanDate) <= new Date(detailB.scanDate) ? [detailA, detailB] : [detailB, detailA];

  const findings = diffByKey<Finding>(
    older.findings.map((f) => ({ key: `${f.category}|${f.title}`, item: f })),
    newer.findings.map((f) => ({ key: `${f.category}|${f.title}`, item: f }))
  );
  const dependencyFindings = diffByKey<DependencyFinding>(
    older.dependencyFindings.map((f) => ({ key: `${f.packageName}|${f.ecosystem}`, item: f })),
    newer.dependencyFindings.map((f) => ({ key: `${f.packageName}|${f.ecosystem}`, item: f }))
  );
  const codeFindings = diffByKey<CodeFinding>(
    older.codeFindings.map((f) => ({ key: `${f.category}|${f.location ?? ""}`, item: f })),
    newer.codeFindings.map((f) => ({ key: `${f.category}|${f.location ?? ""}`, item: f }))
  );

  return NextResponse.json({
    ok: true,
    websiteName: older.websiteName,
    older: { scanId: older.scanId, scanDate: older.scanDate, securityScore: older.securityScore, riskLevel: older.riskLevel },
    newer: { scanId: newer.scanId, scanDate: newer.scanDate, securityScore: newer.securityScore, riskLevel: newer.riskLevel },
    scoreDelta: newer.securityScore - older.securityScore,
    findings,
    dependencyFindings,
    codeFindings,
  });
}

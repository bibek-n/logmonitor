import dns from "dns";
import type { Finding } from "./types";

export interface DnsInfo {
  aRecords: string[];
  aaaaRecords: string[];
  mxRecords: string[];
  txtRecords: string[];
  nsRecords: string[];
  cnameRecords: string[];
  caaRecords: string[];
  dnssecSigned: boolean | null; // null = could not determine (resolver unreachable)
  reverseDns: string[] | null;
}

async function safeResolve<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

// Node's built-in dns module doesn't support DNSKEY/DS record types, so a full DNSSEC chain
// validation isn't possible with only node:dns. Google's public DNS-over-HTTPS JSON API
// (free, keyless) is queried instead, purely to check whether a DNSKEY record exists —
// presence-only, not full chain validation, and labeled as such in the finding.
async function checkDnssec(domain: string): Promise<boolean | null> {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=DNSKEY`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { Answer?: unknown[] };
    return Array.isArray(data.Answer) && data.Answer.length > 0;
  } catch {
    return null;
  }
}

export async function runDnsChecks(domain: string): Promise<{ info: DnsInfo; findings: Finding[] }> {
  const [aRecords, aaaaRecords, mxRecordsRaw, txtRecordsRaw, nsRecords, cnameRecords, caaRecordsRaw, dnssecSigned] = await Promise.all([
    safeResolve(() => dns.promises.resolve4(domain), [] as string[]),
    safeResolve(() => dns.promises.resolve6(domain), [] as string[]),
    safeResolve(() => dns.promises.resolveMx(domain), [] as { exchange: string; priority: number }[]),
    safeResolve(() => dns.promises.resolveTxt(domain), [] as string[][]),
    safeResolve(() => dns.promises.resolveNs(domain), [] as string[]),
    safeResolve(() => dns.promises.resolveCname(domain), [] as string[]),
    safeResolve(() => dns.promises.resolveCaa(domain), [] as { critical: number; issue?: string; issuewild?: string }[]),
    checkDnssec(domain),
  ]);

  let reverseDns: string[] | null = null;
  if (aRecords[0]) {
    reverseDns = await safeResolve(() => dns.promises.reverse(aRecords[0]), []);
  }

  const findings: Finding[] = [];
  findings.push({
    category: "dns_records_summary",
    severity: "info",
    title: "DNS records summary",
    description: `A: ${aRecords.join(", ") || "none"} | AAAA: ${aaaaRecords.join(", ") || "none"} | MX: ${mxRecordsRaw.map((r) => r.exchange).join(", ") || "none"} | NS: ${nsRecords.join(", ") || "none"}${cnameRecords.length ? ` | CNAME: ${cnameRecords.join(", ")}` : ""}`,
  });
  if (caaRecordsRaw.length === 0) {
    findings.push({
      category: "dns_missing_caa",
      severity: "low",
      title: "No CAA record found",
      recommendation: "Publish a CAA record restricting which certificate authorities may issue certificates for this domain.",
    });
  }
  if (dnssecSigned === false) {
    findings.push({
      category: "dns_no_dnssec",
      severity: "info",
      title: "DNSSEC not detected (presence check only)",
      description: "No DNSKEY record found via a public DNS-over-HTTPS resolver. This checks presence only, not full chain validation.",
      recommendation: "Consider enabling DNSSEC with your DNS provider to protect against cache-poisoning/spoofing.",
    });
  }

  const info: DnsInfo = {
    aRecords,
    aaaaRecords,
    mxRecords: mxRecordsRaw.map((r) => `${r.exchange} (priority ${r.priority})`),
    txtRecords: txtRecordsRaw.map((chunks) => chunks.join("")),
    nsRecords,
    cnameRecords,
    caaRecords: caaRecordsRaw.map((r) => r.issue ?? r.issuewild ?? JSON.stringify(r)),
    dnssecSigned,
    reverseDns,
  };
  return { info, findings };
}

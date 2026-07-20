import dns from "dns";
import type { Finding } from "./types";

export interface EmailSecurityInfo {
  mxRecords: string[];
  spf: { present: boolean; record: string | null };
  dkim: { present: boolean; selector: string | null };
  dmarc: { present: boolean; policy: string | null; record: string | null };
  bimi: { present: boolean };
}

async function txtRecords(domain: string): Promise<string[]> {
  try {
    const records = await dns.promises.resolveTxt(domain);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

// DKIM selectors are provider-specific and not discoverable via DNS alone — checking this
// fixed list of common selectors (same limitation this codebase's existing
// spfDkimDmarcCheck() in emailTools.ts already has) is a best-effort signal, not conclusive
// proof of DKIM's absence.
const COMMON_DKIM_SELECTORS = ["default", "selector1", "selector2", "google", "k1", "dkim"];

export async function runEmailSecurityChecks(domain: string): Promise<{ info: EmailSecurityInfo; findings: Finding[] }> {
  const findings: Finding[] = [];

  let mxRecordsRaw: { exchange: string; priority: number }[] = [];
  try {
    mxRecordsRaw = await dns.promises.resolveMx(domain);
  } catch {
    // no MX records — domain may not receive mail directly
  }
  const mxRecords = mxRecordsRaw.map((r) => r.exchange);

  const rootTxt = await txtRecords(domain);
  const spfRecord = rootTxt.find((t) => t.toLowerCase().startsWith("v=spf1")) ?? null;

  let dkimSelectorFound: string | null = null;
  for (const selector of COMMON_DKIM_SELECTORS) {
    const records = await txtRecords(`${selector}._domainkey.${domain}`);
    if (records.some((t) => t.toLowerCase().includes("v=dkim1"))) {
      dkimSelectorFound = selector;
      break;
    }
  }

  const dmarcTxt = await txtRecords(`_dmarc.${domain}`);
  const dmarcRecord = dmarcTxt.find((t) => t.toLowerCase().startsWith("v=dmarc1")) ?? null;
  const dmarcPolicyMatch = dmarcRecord ? /p=(\w+)/i.exec(dmarcRecord) : null;
  const dmarcPolicy = dmarcPolicyMatch ? dmarcPolicyMatch[1].toLowerCase() : null;

  const bimiTxt = await txtRecords(`default._bimi.${domain}`);
  const bimiPresent = bimiTxt.some((t) => t.toLowerCase().startsWith("v=bimi1"));

  if (!spfRecord) {
    findings.push({
      category: "email_spf_missing",
      severity: "medium",
      title: "No SPF record found",
      recommendation: "Publish a v=spf1 TXT record listing your authorized outbound mail servers.",
    });
  } else {
    findings.push({ category: "email_records_summary", severity: "info", title: "SPF record found", evidence: spfRecord });
  }
  if (!dkimSelectorFound) {
    findings.push({
      category: "email_dkim_missing",
      severity: "low",
      title: "No DKIM record found at common selectors",
      description: `Checked selectors: ${COMMON_DKIM_SELECTORS.join(", ")}. DKIM selectors are provider-specific, so this is not fully conclusive.`,
      recommendation: "Confirm your mail provider's DKIM selector and ensure the corresponding TXT record is published.",
    });
  } else {
    findings.push({ category: "email_records_summary", severity: "info", title: `DKIM record found at selector "${dkimSelectorFound}"` });
  }
  if (!dmarcRecord) {
    findings.push({
      category: "email_dmarc_missing",
      severity: "medium",
      title: "No DMARC record found",
      recommendation: "Publish a _dmarc TXT record with at least p=quarantine to reduce domain spoofing.",
    });
  } else if (dmarcPolicy === "none") {
    findings.push({
      category: "email_dmarc_weak_policy",
      severity: "low",
      title: "DMARC policy is p=none (monitor only)",
      evidence: dmarcRecord,
      recommendation: "Move to p=quarantine or p=reject once DMARC reports confirm legitimate mail flows are correctly authenticated.",
    });
  } else {
    findings.push({ category: "email_records_summary", severity: "info", title: `DMARC policy: p=${dmarcPolicy}`, evidence: dmarcRecord });
  }
  if (!bimiPresent) {
    findings.push({
      category: "email_bimi_missing",
      severity: "info",
      title: "No BIMI record found",
      description: "Informational — BIMI is a brand-visibility feature and typically requires DMARC enforcement first.",
    });
  }

  const info: EmailSecurityInfo = {
    mxRecords,
    spf: { present: !!spfRecord, record: spfRecord },
    dkim: { present: !!dkimSelectorFound, selector: dkimSelectorFound },
    dmarc: { present: !!dmarcRecord, policy: dmarcPolicy, record: dmarcRecord },
    bimi: { present: bimiPresent },
  };
  return { info, findings };
}

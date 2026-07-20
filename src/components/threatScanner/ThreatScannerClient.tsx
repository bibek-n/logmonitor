"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Link2, Search, History, ShieldCheck, ShieldAlert, ShieldX, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ToastProvider, useToast } from "@/components/ui/Toast";
// Type-only import - shared.ts is safe for client bundles (see the equivalent split in
// src/lib/websitePerformance/shared.ts); the DB/VT/file-storage code lives in sibling files
// that must never be imported from here.
import type { ThreatScanRow, ThreatEngineResultRow } from "@/lib/threatScanner/shared";

export interface WebsiteOption {
  Id: number;
  Name: string;
  Url: string;
}

type FullScan = ThreatScanRow & { engines: ThreatEngineResultRow[] };

const TABS = ["File", "URL", "Search", "History"] as const;
type Tab = (typeof TABS)[number];

const badgeTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  Malicious: "danger",
  Suspicious: "warning",
  Clean: "success",
};

function vtGuiLink(scan: Pick<ThreatScanRow, "Kind" | "Target" | "VtResourceId">): string | null {
  if (scan.Kind === "File" || scan.Kind === "Hash") {
    const hash = scan.VtResourceId || (scan.Kind === "Hash" ? scan.Target : null);
    return hash ? `https://www.virustotal.com/gui/file/${encodeURIComponent(hash)}` : null;
  }
  if (scan.Kind === "Url") return scan.VtResourceId ? `https://www.virustotal.com/gui/url/${encodeURIComponent(scan.VtResourceId)}` : null;
  if (scan.Kind === "Ip") return `https://www.virustotal.com/gui/ip-address/${encodeURIComponent(scan.Target)}`;
  if (scan.Kind === "Domain") return `https://www.virustotal.com/gui/domain/${encodeURIComponent(scan.Target)}`;
  return null;
}

function scanStageText(elapsedSeconds: number): string {
  if (elapsedSeconds < 10) return "Submitting to VirusTotal...";
  if (elapsedSeconds < 30) return "Waiting for antivirus engines to analyze this submission...";
  return "Still analyzing - VirusTotal scans can take up to 2 minutes for a first-time submission...";
}

function ScanProgressBanner({ elapsedSeconds, live }: { elapsedSeconds: number; live: { malicious: number; suspicious: number } | null }) {
  return (
    <Card style={{ marginBottom: "1rem", padding: "0.85rem 1rem" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Scanning...</span>
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>{elapsedSeconds}s elapsed</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "var(--surface-2)", overflow: "hidden" }}>
        <div className="threat-scan-progress-bar" style={{ height: "100%", width: "40%", borderRadius: 999, background: "var(--primary)" }} />
      </div>
      <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", margin: "0.5rem 0 0" }}>
        {scanStageText(elapsedSeconds)}
        {live && (live.malicious > 0 || live.suspicious > 0) && (
          <span style={{ color: "var(--danger)", fontWeight: 600 }}>
            {" "}
            {live.malicious} malicious / {live.suspicious} suspicious so far...
          </span>
        )}
      </p>
      <style>{`
        @keyframes threatScanProgressSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        .threat-scan-progress-bar { animation: threatScanProgressSlide 1.4s ease-in-out infinite; }
      `}</style>
    </Card>
  );
}

function EngineTable({ engines }: { engines: ThreatEngineResultRow[] }) {
  const [showAll, setShowAll] = useState(false);
  const flagged = engines.filter((e) => e.category === "malicious" || e.category === "suspicious");
  const visible = showAll ? engines : flagged;

  if (engines.length === 0) return null;

  return (
    <div style={{ marginTop: "0.9rem" }}>
      <button
        onClick={() => setShowAll((v) => !v)}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--series-1)", fontSize: "0.8rem", cursor: "pointer", padding: 0, marginBottom: "0.5rem" }}
      >
        {showAll ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showAll ? `Hide clean engines` : `Show all ${engines.length} engines`}
      </button>
      {visible.length === 0 ? (
        <p style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>No engines flagged this resource.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.4rem" }}>Engine</th>
                <th style={{ padding: "0.4rem" }}>Category</th>
                <th style={{ padding: "0.4rem" }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.engineName} style={{ borderBottom: "1px solid var(--grid)" }}>
                  <td style={{ padding: "0.4rem" }}>{e.engineName}</td>
                  <td style={{ padding: "0.4rem" }}>
                    <Badge tone={e.category === "malicious" ? "danger" : e.category === "suspicious" ? "warning" : "neutral"}>{e.category}</Badge>
                  </td>
                  <td style={{ padding: "0.4rem", color: e.result ? "var(--danger)" : "var(--ink-muted)" }}>{e.result ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScanResultView({ scan }: { scan: FullScan }) {
  if (scan.Status === "Failed") {
    return (
      <Card style={{ marginTop: "1rem" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "0.4rem" }}>
          <ShieldX size={18} style={{ color: "var(--danger)" }} />
          <strong>Scan failed</strong>
        </div>
        <p style={{ fontSize: "0.83rem", color: "var(--ink-muted)" }}>{scan.ErrorMessage ?? "Unknown error."}</p>
      </Card>
    );
  }

  if (scan.Status === "NotFound") {
    return (
      <Card style={{ marginTop: "1rem" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "0.4rem" }}>
          <Search size={18} style={{ color: "var(--ink-muted)" }} />
          <strong>No report found</strong>
        </div>
        <p style={{ fontSize: "0.83rem", color: "var(--ink-muted)" }}>
          VirusTotal has no existing report for &quot;{scan.Target}&quot;. Hash/IP/domain lookups only read reports VirusTotal
          already has on file - submit the actual file or URL via the File/URL tabs to generate a fresh scan.
        </p>
      </Card>
    );
  }

  if (scan.Status !== "Completed") return null;

  const link = vtGuiLink(scan);
  const total = scan.EngineCount ?? 0;

  return (
    <Card style={{ marginTop: "1rem" }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: "0.75rem" }}>
        <div className="flex items-center gap-2">
          {scan.Verdict === "Clean" ? (
            <ShieldCheck size={20} style={{ color: "var(--success)" }} />
          ) : (
            <ShieldAlert size={20} style={{ color: scan.Verdict === "Malicious" ? "var(--danger)" : "var(--warning)" }} />
          )}
          <Badge tone={badgeTone[scan.Verdict ?? "Clean"]}>{scan.Verdict ?? "Clean"}</Badge>
          <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>{scan.Target}</span>
        </div>
        {link && (
          <a href={link} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "var(--series-1)" }}>
            View on VirusTotal <ExternalLink size={12} />
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-3" style={{ fontSize: "0.82rem" }}>
        <span style={{ color: "var(--danger)" }}>{scan.MaliciousCount ?? 0} malicious</span>
        <span style={{ color: "var(--warning)" }}>{scan.SuspiciousCount ?? 0} suspicious</span>
        <span style={{ color: "var(--success)" }}>{scan.HarmlessCount ?? 0} harmless</span>
        <span style={{ color: "var(--ink-muted)" }}>{scan.UndetectedCount ?? 0} undetected</span>
        {(scan.TimeoutCount ?? 0) > 0 && <span style={{ color: "var(--ink-muted)" }}>{scan.TimeoutCount} timed out</span>}
        <span style={{ color: "var(--ink-muted)" }}>({total} engines total)</span>
      </div>

      <EngineTable engines={scan.engines} />
    </Card>
  );
}

function ThreatScannerClientInner({ websites }: { websites: WebsiteOption[] }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("File");

  const [activeScan, setActiveScan] = useState<FullScan | null>(null);
  const [polling, setPolling] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [urlValue, setUrlValue] = useState("");
  const [websiteChoice, setWebsiteChoice] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<ThreatScanRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySelected, setHistorySelected] = useState<FullScan | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!polling) {
      setElapsedSeconds(0);
      return;
    }
    const startedAt = Date.now();
    const intervalId = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(intervalId);
  }, [polling]);

  async function fetchScan(scanId: number): Promise<FullScan | null> {
    const res = await fetch(`/api/admin/threat-scanner/scans/${scanId}`);
    const data = await res.json();
    return data.ok ? data.data : null;
  }

  function pollScan(scanId: number) {
    setPolling(true);
    const step = async () => {
      const scan = await fetchScan(scanId);
      if (!scan) {
        setPolling(false);
        return;
      }
      setActiveScan(scan);
      if (scan.Status === "Running" || scan.Status === "Pending") {
        pollTimeoutRef.current = setTimeout(step, 3000);
      } else {
        setPolling(false);
        if (tab === "History") loadHistory(historyPage);
      }
    };
    void step();
  }

  async function submitFile() {
    if (!file) {
      toast.show({ type: "error", message: "Choose a file first." });
      return;
    }
    setSubmitting(true);
    setActiveScan(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/threat-scanner/scan/file", { method: "POST", body: form });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to start scan.");
      pollScan(data.scanId);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to start scan." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUrl() {
    if (!urlValue.trim()) {
      toast.show({ type: "error", message: "Enter a URL first." });
      return;
    }
    setSubmitting(true);
    setActiveScan(null);
    try {
      const res = await fetch("/api/admin/threat-scanner/scan/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlValue.trim(), websiteId: websiteChoice || null }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Failed to start scan.");
      pollScan(data.scanId);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to start scan." });
    } finally {
      setSubmitting(false);
    }
  }

  async function submitSearch() {
    if (!searchValue.trim()) {
      toast.show({ type: "error", message: "Enter a file hash, IP address, or domain first." });
      return;
    }
    setSubmitting(true);
    setActiveScan(null);
    try {
      const res = await fetch("/api/admin/threat-scanner/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: searchValue.trim() }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Lookup failed.");
      const scan = await fetchScan(data.scanId);
      setActiveScan(scan);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Lookup failed." });
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistory(page: number) {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/threat-scanner/scans?page=${page}&pageSize=25`);
      const data = await res.json();
      if (data.ok) {
        setHistory(data.data);
        setHistoryPage(data.pagination.page);
        setHistoryTotalPages(data.pagination.totalPages);
      }
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    if (tab === "History" && history.length === 0) void loadHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function openHistoryScan(id: number) {
    const scan = await fetchScan(id);
    setHistorySelected(scan);
  }

  const websiteOptions = [{ label: "Choose from registered websites...", value: "" }, ...websites.map((w) => ({ label: `${w.Name} — ${w.Url}`, value: String(w.Id) }))];

  const liveStats = activeScan ? { malicious: activeScan.MaliciousCount ?? 0, suspicious: activeScan.SuspiciousCount ?? 0 } : null;

  return (
    <>
      <div className="flex flex-wrap gap-1" style={{ marginBottom: "1rem", borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "0.5rem 0.85rem",
              border: "none",
              background: "none",
              borderBottom: tab === t ? "2px solid var(--series-1)" : "2px solid transparent",
              color: tab === t ? "var(--ink)" : "var(--ink-muted)",
              fontSize: "0.83rem",
              fontWeight: tab === t ? 600 : 400,
              cursor: "pointer",
            }}
          >
            {t === "File" && <Upload size={14} />}
            {t === "URL" && <Link2 size={14} />}
            {t === "Search" && <Search size={14} />}
            {t === "History" && <History size={14} />}
            {t}
          </button>
        ))}
      </div>

      {tab === "File" && (
        <Card>
          <p style={{ fontSize: "0.83rem", color: "var(--ink-muted)", marginTop: 0 }}>
            Upload a file to scan it against ~70 antivirus engines via VirusTotal. Maximum 32 MB per file.
          </p>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: "0.85rem", marginBottom: "0.75rem", display: "block" }}
          />
          <Button onClick={submitFile} disabled={submitting || polling || !file}>
            <Upload size={14} /> {submitting ? "Uploading..." : "Scan File"}
          </Button>
        </Card>
      )}

      {tab === "URL" && (
        <Card>
          <p style={{ fontSize: "0.83rem", color: "var(--ink-muted)", marginTop: 0 }}>
            Scan a URL for phishing, malware distribution, or other malicious content.
          </p>
          <div className="field" style={{ marginBottom: "0.6rem" }}>
            <label htmlFor="threat-website-picker">Pick from registered websites (optional)</label>
            <Select
              value={websiteChoice}
              onChange={(v) => {
                setWebsiteChoice(v);
                const picked = websites.find((w) => String(w.Id) === v);
                if (picked) setUrlValue(picked.Url);
              }}
              options={websiteOptions}
            />
          </div>
          <div className="field" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="threat-url-input">URL</label>
            <input
              id="threat-url-input"
              type="text"
              value={urlValue}
              onChange={(e) => {
                setUrlValue(e.target.value);
                setWebsiteChoice("");
              }}
              placeholder="https://example.com/suspicious-page"
              style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
          </div>
          <Button onClick={submitUrl} disabled={submitting || polling || !urlValue.trim()}>
            <Link2 size={14} /> {submitting ? "Submitting..." : "Scan URL"}
          </Button>
        </Card>
      )}

      {tab === "Search" && (
        <Card>
          <p style={{ fontSize: "0.83rem", color: "var(--ink-muted)", marginTop: 0 }}>
            Look up an existing VirusTotal report for a file hash (MD5/SHA-1/SHA-256), IP address, or domain.
          </p>
          <div className="field" style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="threat-search-input">Hash, IP address, or domain</label>
            <input
              id="threat-search-input"
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="e.g. 44d88612fea8a8f36de82e1278abb02f, 8.8.8.8, or example.com"
              style={{ width: "100%", padding: "0.5rem 0.65rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--ink)", fontSize: "0.85rem" }}
            />
          </div>
          <Button onClick={submitSearch} disabled={submitting || !searchValue.trim()}>
            <Search size={14} /> {submitting ? "Searching..." : "Search"}
          </Button>
        </Card>
      )}

      {tab !== "History" && polling && <ScanProgressBanner elapsedSeconds={elapsedSeconds} live={liveStats} />}
      {tab !== "History" && activeScan && !polling && <ScanResultView scan={activeScan} />}

      {tab === "History" && (
        <Card>
          {historyLoading ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>Loading...</p>
          ) : history.length === 0 ? (
            <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No scans yet.</p>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ padding: "0.5rem" }}>Kind</th>
                      <th style={{ padding: "0.5rem" }}>Target</th>
                      <th style={{ padding: "0.5rem" }}>Status</th>
                      <th style={{ padding: "0.5rem" }}>Verdict</th>
                      <th style={{ padding: "0.5rem" }}>Scanned</th>
                      <th style={{ padding: "0.5rem" }}>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr
                        key={h.Id}
                        onClick={() => openHistoryScan(h.Id)}
                        style={{ borderBottom: "1px solid var(--grid)", cursor: "pointer" }}
                      >
                        <td style={{ padding: "0.5rem" }}>{h.Kind}</td>
                        <td style={{ padding: "0.5rem", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.Target}</td>
                        <td style={{ padding: "0.5rem" }}>{h.Status}</td>
                        <td style={{ padding: "0.5rem" }}>
                          {h.Verdict ? <Badge tone={badgeTone[h.Verdict]}>{h.Verdict}</Badge> : <span style={{ color: "var(--ink-muted)" }}>-</span>}
                        </td>
                        <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{h.CreatedAt ? new Date(h.CreatedAt).toLocaleString() : "-"}</td>
                        <td style={{ padding: "0.5rem" }}>{h.TriggeredByUsername ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between" style={{ marginTop: "0.75rem" }}>
                <Button variant="secondary" size="sm" disabled={historyPage <= 1} onClick={() => loadHistory(historyPage - 1)}>
                  Previous
                </Button>
                <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>
                  Page {historyPage} of {historyTotalPages}
                </span>
                <Button variant="secondary" size="sm" disabled={historyPage >= historyTotalPages} onClick={() => loadHistory(historyPage + 1)}>
                  Next
                </Button>
              </div>
            </>
          )}
          {historySelected && <ScanResultView scan={historySelected} />}
        </Card>
      )}
    </>
  );
}

export default function ThreatScannerClient({ websites }: { websites: WebsiteOption[] }) {
  return (
    <ToastProvider>
      <ThreatScannerClientInner websites={websites} />
    </ToastProvider>
  );
}

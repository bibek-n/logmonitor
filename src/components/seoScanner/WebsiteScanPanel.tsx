"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface WebsiteOption {
  Id: number;
  Name: string;
  Url: string;
}

// Dropdown pulls from the shared Websites registry ("save it once on the Audit Websites
// page, pick it here") rather than accepting an arbitrary URL - matches "take all sites
// from the website submenu" and keeps this scanner from being usable to probe arbitrary URLs.
function WebsiteScanPanelInner() {
  const router = useRouter();
  const toast = useToast();
  const [websites, setWebsites] = useState<WebsiteOption[]>([]);
  const [selected, setSelected] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/seo-scanner/websites")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setWebsites(d.data);
      })
      .finally(() => setLoadingList(false));
  }, []);

  async function runScan() {
    if (!selected) return;
    const website = websites.find((w) => w.Id === Number(selected));
    if (!website) return;
    setScanning(true);
    try {
      const res = await fetch("/api/admin/seo-scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteId: website.Id, url: website.Url }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Scan failed");
      toast.show({ type: "success", message: `Scan complete: ${data.report.score}/100 (${data.report.grade}).` });
      router.push(`/dashboard/seo-scanner/scans/${data.scanId}`);
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="dash-panel flex items-center gap-2 flex-wrap" style={{ marginBottom: "1.5rem" }}>
      <SearchCheck size={16} style={{ color: "var(--ink-muted)", flexShrink: 0 }} />
      <span style={{ fontSize: "0.85rem", color: "var(--ink-muted)" }}>Scan a website:</span>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={loadingList || scanning}
        style={{
          padding: "0.35rem 0.5rem",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          minWidth: 260,
        }}
      >
        <option value="">{loadingList ? "Loading websites..." : "Select a website..."}</option>
        {websites.map((w) => (
          <option key={w.Id} value={w.Id}>
            {w.Name} ({w.Url})
          </option>
        ))}
      </select>
      <Button size="sm" onClick={runScan} disabled={!selected || scanning}>
        {scanning ? "Scanning..." : "Scan Now"}
      </Button>
      {websites.length === 0 && !loadingList && (
        <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>No websites saved yet - add one on the Audit Websites page first.</span>
      )}
    </div>
  );
}

export function WebsiteScanPanel() {
  return (
    <ToastProvider>
      <WebsiteScanPanelInner />
    </ToastProvider>
  );
}

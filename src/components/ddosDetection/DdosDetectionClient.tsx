"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ShieldOff, Ban } from "lucide-react";

const TABS = [
  { key: "requests", label: "Requests/sec" },
  { key: "attackers", label: "Top Attackers" },
  { key: "blocked", label: "Blocked IPs" },
  { key: "timeline", label: "Mitigation Timeline" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const WINDOWS = [
  { key: 4, label: "4h" },
  { key: 24, label: "24h" },
  { key: 168, label: "7d" },
] as const;

interface RequestBucket {
  bucket: string;
  count: number;
}
interface TopAttacker {
  ip: string;
  alertCount: number;
  totalOccurrences: number;
  severityRank: number;
  lastSeenAt: string;
}
interface TimelineAlertEntry {
  type: "alert";
  id: number;
  category: string;
  severity: string;
  sourceIp: string | null;
  requestPath: string | null;
  occurrenceCount: number;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
}
interface TimelineBlockEntry {
  type: "block";
  id: number;
  ipOrCidr: string;
  reason: string | null;
  at: string;
}
type TimelineEntry = TimelineAlertEntry | TimelineBlockEntry;
interface SummaryData {
  requestBuckets: RequestBucket[];
  topAttackers: TopAttacker[];
  timeline: TimelineEntry[];
}
interface BlocklistEntry {
  Id: number;
  IpOrCidr: string;
  Reason: string | null;
  Source: string;
  IsActive: boolean;
  CreatedAt: string;
  ExpiresAt: string | null;
}

const SEVERITY_LABELS = ["Informational", "Low", "Medium", "High", "Critical"];
const SEVERITY_TONES: Array<"neutral" | "warning" | "danger"> = ["neutral", "neutral", "warning", "danger", "danger"];

function DdosDetectionInner() {
  const toast = useToast();
  const [tab, setTab] = useState<TabKey>("requests");
  const [hours, setHours] = useState<number>(24);
  const [data, setData] = useState<SummaryData | null>(null);
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockingIp, setBlockingIp] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ddos-detection/summary?hours=${hours}`);
      const json = await res.json();
      if (json.ok) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  const loadBlocklist = useCallback(async () => {
    const res = await fetch("/api/admin/intrusion-detection/blocklist");
    const json = await res.json();
    if (json.ok) setBlocklist(json.data);
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadBlocklist();
  }, [loadBlocklist]);

  async function blockIp(ip: string) {
    setBlockingIp(ip);
    try {
      const res = await fetch("/api/admin/intrusion-detection/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ipOrCidr: ip, reason: "Flagged by DDoS Detection (high request rate / bot activity)" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to add to blocklist.");
      toast.show({ type: "success", message: json.note ?? `${ip} added to the blocklist.` });
      loadBlocklist();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBlockingIp(null);
    }
  }

  async function unblockIp(entry: BlocklistEntry) {
    try {
      const res = await fetch(`/api/admin/intrusion-detection/blocklist/${entry.Id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to remove.");
      toast.show({ type: "success", message: `${entry.IpOrCidr} removed from the active blocklist.` });
      loadBlocklist();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const isBlocked = useCallback((ip: string) => blocklist.some((b) => b.IsActive && b.IpOrCidr === ip), [blocklist]);

  return (
    <div>
      <div className="flex gap-1" style={{ borderBottom: "1px solid var(--border)", marginBottom: "1rem", overflowX: "auto" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "0.55rem 1rem",
              fontSize: "0.85rem",
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? "var(--primary)" : "var(--ink-muted)",
              borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: -1,
              whiteSpace: "nowrap",
              flexShrink: 0,
              background: "none",
              border: "none",
              borderBottomWidth: 2,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "blocked" && (
        <div className="flex flex-wrap gap-2 mb-4" style={{ fontSize: "0.8rem" }}>
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setHours(w.key)}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: hours === w.key ? "var(--primary)" : "var(--surface-2)",
                color: hours === w.key ? "#fff" : "var(--ink)",
                cursor: "pointer",
              }}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}

      <Card>
        {loading && tab !== "blocked" ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : tab === "requests" ? (
          <RequestsPerSecTab buckets={data?.requestBuckets ?? []} hours={hours} />
        ) : tab === "attackers" ? (
          <TopAttackersTab attackers={data?.topAttackers ?? []} isBlocked={isBlocked} blockingIp={blockingIp} onBlock={blockIp} />
        ) : tab === "blocked" ? (
          <BlockedIpsTab entries={blocklist} onUnblock={unblockIp} onManualAdd={blockIp} />
        ) : (
          <TimelineTab entries={data?.timeline ?? []} />
        )}
      </Card>
    </div>
  );
}

function RequestsPerSecTab({ buckets, hours }: { buckets: RequestBucket[]; hours: number }) {
  if (buckets.length === 0) return <Empty text="No request activity recorded in this window." />;
  const bucketSeconds = hours <= 4 ? 60 : 3600;
  const max = Math.max(...buckets.map((b) => b.count));

  return (
    <div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.75rem" }}>
        Total monitored requests per {hours <= 4 ? "minute" : "hour"}, shown as an average requests/sec for that bucket.
      </p>
      <div className="flex flex-col gap-1">
        {buckets.map((b) => (
          <div key={b.bucket} className="flex items-center gap-2" style={{ fontSize: "0.78rem" }}>
            <span style={{ width: 130, flexShrink: 0, color: "var(--ink-muted)", fontFamily: "monospace" }}>{b.bucket.replace("T", " ")}</span>
            <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 4, height: 14, overflow: "hidden" }}>
              <div style={{ width: `${(b.count / max) * 100}%`, background: "var(--primary)", height: "100%" }} />
            </div>
            <span style={{ width: 90, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
              {(b.count / bucketSeconds).toFixed(2)} req/s
            </span>
            <span style={{ width: 70, flexShrink: 0, textAlign: "right", color: "var(--ink-muted)", fontVariantNumeric: "tabular-nums" }}>
              ({b.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopAttackersTab({
  attackers,
  isBlocked,
  blockingIp,
  onBlock,
}: {
  attackers: TopAttacker[];
  isBlocked: (ip: string) => boolean;
  blockingIp: string | null;
  onBlock: (ip: string) => void;
}) {
  if (attackers.length === 0) return <Empty text="No source IP has triggered a high-request-rate or bot-activity alert in this window." />;

  return (
    <>
      <div className="flex flex-col gap-2 md:hidden">
        {attackers.map((a) => (
          <div key={a.ip} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem" }}>
            <div className="flex items-center justify-between gap-2">
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{a.ip}</span>
              <Badge tone={SEVERITY_TONES[a.severityRank]}>{SEVERITY_LABELS[a.severityRank]}</Badge>
            </div>
            <p style={{ margin: "0.3rem 0 0.5rem", fontSize: "0.78rem", color: "var(--ink-muted)" }}>
              {a.alertCount} alert(s) · {a.totalOccurrences} occurrence(s) · last seen {a.lastSeenAt}
            </p>
            <BlockButton ip={a.ip} isBlocked={isBlocked(a.ip)} blocking={blockingIp === a.ip} onBlock={onBlock} />
          </div>
        ))}
      </div>

      <div className="hidden md:block" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              {["Source IP", "Severity", "Alerts", "Occurrences", "Last Seen", ""].map((h) => (
                <th key={h} style={{ padding: "0.5rem", color: "var(--ink-muted)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attackers.map((a) => (
              <tr key={a.ip} style={{ borderBottom: "1px solid var(--grid)" }}>
                <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{a.ip}</td>
                <td style={{ padding: "0.5rem" }}>
                  <Badge tone={SEVERITY_TONES[a.severityRank]}>{SEVERITY_LABELS[a.severityRank]}</Badge>
                </td>
                <td style={{ padding: "0.5rem" }}>{a.alertCount}</td>
                <td style={{ padding: "0.5rem" }}>{a.totalOccurrences}</td>
                <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{a.lastSeenAt}</td>
                <td style={{ padding: "0.5rem" }}>
                  <BlockButton ip={a.ip} isBlocked={isBlocked(a.ip)} blocking={blockingIp === a.ip} onBlock={onBlock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BlockButton({ ip, isBlocked, blocking, onBlock }: { ip: string; isBlocked: boolean; blocking: boolean; onBlock: (ip: string) => void }) {
  if (isBlocked) {
    return (
      <Badge tone="danger">
        <ShieldOff size={11} /> Blocked
      </Badge>
    );
  }
  return (
    <button
      onClick={() => onBlock(ip)}
      disabled={blocking}
      className="flex items-center gap-1"
      style={{
        background: "none",
        border: "1px solid var(--border)",
        color: "var(--danger)",
        borderRadius: 6,
        padding: "0.2rem 0.55rem",
        fontSize: "0.75rem",
        cursor: blocking ? "default" : "pointer",
        opacity: blocking ? 0.6 : 1,
        whiteSpace: "nowrap",
      }}
    >
      <Ban size={12} /> {blocking ? "Adding..." : "Block IP"}
    </button>
  );
}

function BlockedIpsTab({
  entries,
  onUnblock,
  onManualAdd,
}: {
  entries: BlocklistEntry[];
  onUnblock: (entry: BlocklistEntry) => void;
  onManualAdd: (ip: string) => void;
}) {
  const [manualIp, setManualIp] = useState("");
  const active = entries.filter((e) => e.IsActive);
  const inactive = entries.filter((e) => !e.IsActive);

  return (
    <div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.78rem", marginTop: 0, marginBottom: "0.75rem" }}>
        Tracked for visibility and audit history only - adding an entry here does not itself block any traffic yet
        (live enforcement against the router/firewall is a planned follow-up). Use it to record which source IPs
        have been identified and treated as blocked.
      </p>

      <div className="flex gap-2 mb-4" style={{ flexWrap: "wrap" }}>
        <input
          value={manualIp}
          onChange={(e) => setManualIp(e.target.value)}
          placeholder="IP address or CIDR to add manually..."
          style={{ flex: "1 1 220px", padding: "0.4rem 0.6rem", borderRadius: 8, border: "1px solid var(--border)", background: "var(--plane)", color: "var(--ink)", fontSize: "0.82rem" }}
        />
        <button
          onClick={() => {
            if (!manualIp.trim()) return;
            onManualAdd(manualIp.trim());
            setManualIp("");
          }}
          className="submit"
          style={{ width: "auto", marginTop: 0, padding: "0.4rem 1rem" }}
        >
          Add to Blocklist
        </button>
      </div>

      {active.length === 0 ? (
        <Empty text="No IPs are currently marked as blocked." />
      ) : (
        <div className="flex flex-col gap-2">
          {active.map((e) => (
            <div
              key={e.Id}
              className="flex items-center justify-between gap-2"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem", flexWrap: "wrap" }}
            >
              <div>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{e.IpOrCidr}</span>
                <span style={{ marginLeft: "0.5rem" }}>
                  <Badge tone="neutral">{e.Source}</Badge>
                </span>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.76rem", color: "var(--ink-muted)" }}>
                  {e.Reason ?? "No reason given"} · added {e.CreatedAt}
                  {e.ExpiresAt ? ` · expires ${e.ExpiresAt}` : ""}
                </p>
              </div>
              <button
                onClick={() => onUnblock(e)}
                style={{ background: "none", border: "1px solid var(--border)", color: "var(--ink-muted)", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.75rem", cursor: "pointer" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <details style={{ marginTop: "1rem" }}>
          <summary style={{ fontSize: "0.8rem", color: "var(--ink-muted)", cursor: "pointer" }}>{inactive.length} removed entry(ies) - history</summary>
          <div className="flex flex-col gap-1" style={{ marginTop: "0.5rem" }}>
            {inactive.map((e) => (
              <p key={e.Id} style={{ fontSize: "0.76rem", color: "var(--ink-muted)", margin: 0, fontFamily: "monospace" }}>
                {e.IpOrCidr} - {e.Reason ?? "no reason"} (added {e.CreatedAt})
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TimelineTab({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return <Empty text="No mitigation activity (alerts or blocklist changes) in this window." />;

  return (
    <div className="flex flex-col gap-3">
      {entries.map((e) =>
        e.type === "alert" ? (
          <div key={`alert-${e.id}`} className="flex items-start gap-3">
            <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0, background: e.severity === "critical" || e.severity === "high" ? "var(--danger)" : "var(--warning)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                <strong>{e.category === "high_request_rate" ? "High request rate" : "Bot activity"}</strong> from{" "}
                <span style={{ fontFamily: "monospace" }}>{e.sourceIp ?? "unknown IP"}</span>
                {e.requestPath ? (
                  <>
                    {" "}targeting <span style={{ fontFamily: "monospace" }}>{e.requestPath}</span>
                  </>
                ) : null}
              </p>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.76rem", color: "var(--ink-muted)" }}>
                {e.occurrenceCount} occurrence(s) · {e.firstSeenAt} → {e.lastSeenAt} · status: {e.status}
              </p>
            </div>
          </div>
        ) : (
          <div key={`block-${e.id}`} className="flex items-start gap-3">
            <div style={{ width: 8, height: 8, borderRadius: "50%", marginTop: 6, flexShrink: 0, background: "var(--ink-muted)" }} />
            <div>
              <p style={{ margin: 0, fontSize: "0.85rem" }}>
                Added <span style={{ fontFamily: "monospace" }}>{e.ipOrCidr}</span> to the blocklist
              </p>
              <p style={{ margin: "0.15rem 0 0", fontSize: "0.76rem", color: "var(--ink-muted)" }}>
                {e.reason ?? "No reason given"} · {e.at}
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p style={{ color: "var(--ink-muted)" }}>{text}</p>;
}

export function DdosDetectionClient() {
  return (
    <ToastProvider>
      <DdosDetectionInner />
    </ToastProvider>
  );
}

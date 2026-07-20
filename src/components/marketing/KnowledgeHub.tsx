"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraduationCap, Cpu, Code2 } from "lucide-react";
import { MKT } from "@/lib/marketingTheme";
import type { KnowledgeGroups, KnowledgeItem } from "@/lib/knowledgeFeed";

const REFRESH_MS = 60 * 60 * 1000; // the underlying feeds only revalidate every 3 days server-side; this just picks that up promptly once it happens
const EMPTY_GROUPS: KnowledgeGroups = { hardwareNetworking: [], softwareAi: [] };

function KnowledgeGroup({ icon: Icon, title, items, loading }: { icon: typeof Cpu; title: string; items: KnowledgeItem[]; loading: boolean }) {
  return (
    <div style={{ border: `1px solid ${MKT.border}`, borderRadius: 12, padding: "1.25rem", background: "#fff" }}>
      <div className="flex items-center gap-2" style={{ marginBottom: "0.9rem" }}>
        <Icon size={18} style={{ color: MKT.primary }} />
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: MKT.ink, margin: 0 }}>{title}</h3>
      </div>
      {loading && items.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: MKT.inkMuted }}>Loading...</p>
      ) : items.length === 0 ? (
        <p style={{ fontSize: "0.85rem", color: MKT.inkMuted }}>No materials available right now.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {items.map((item, i) => (
            <li key={i}>
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                style={{ color: MKT.ink, textDecoration: "none", fontSize: "0.87rem", fontWeight: 500, lineHeight: 1.4 }}
              >
                {item.title}
              </a>
              {item.pubDate && (
                <div style={{ fontSize: "0.72rem", color: MKT.inkMuted, marginTop: "0.2rem" }}>
                  {new Date(item.pubDate).toLocaleDateString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Client Component fetching /api/public/knowledge — refetches on mount, hourly, and whenever
// the tab regains focus (same reasoning as useLiveFeed; kept as its own effect here rather
// than reusing that hook since the response is a pair of groups, not a flat items array).
export function KnowledgeHub() {
  const [groups, setGroups] = useState<KnowledgeGroups>(EMPTY_GROUPS);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch("/api/public/knowledge");
      const data = await res.json();
      if (mountedRef.current && data.ok && data.groups) {
        setGroups(data.groups);
      }
    } catch {
      // Leave whatever was already showing — a failed refresh shouldn't blank the widget.
    } finally {
      inFlightRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const interval = setInterval(load, REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [load]);

  return (
    <section style={{ background: MKT.surface, padding: "2.5rem 1.25rem" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "0.5rem" }}>
          <GraduationCap size={22} style={{ color: MKT.primary }} />
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: MKT.ink, margin: 0 }}>Knowledge Hub</h2>
        </div>
        <p style={{ color: MKT.inkMuted, fontSize: "0.9rem", lineHeight: 1.6, marginBottom: "1.5rem", maxWidth: 720 }}>
          Free learning and training materials for IT hardware, networking, software, and AI — tracked from
          established free-training sources and refreshed every few days.
        </p>
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <KnowledgeGroup icon={Cpu} title="IT Hardware & Networking" items={groups.hardwareNetworking} loading={loading} />
          <KnowledgeGroup icon={Code2} title="Software & AI" items={groups.softwareAi} loading={loading} />
        </div>
      </div>
    </section>
  );
}

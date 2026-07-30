"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface SslRow {
  MonitorId: number;
  MonitorName: string;
  Domain: string | null;
  Issuer: string | null;
  ValidFrom: string | null;
  ExpiresAt: string | null;
  DaysRemaining: number | null;
  HostnameMatch: boolean | null;
  ChainValid: boolean | null;
  SelfSigned: boolean | null;
  TlsProtocol: string | null;
}

function statusFor(r: SslRow): { label: string; color: string } {
  if (r.SelfSigned || r.ChainValid === false || r.HostnameMatch === false) return { label: "Invalid", color: "var(--danger)" };
  if (r.DaysRemaining == null) return { label: "Unknown", color: "var(--ink-muted)" };
  if (r.DaysRemaining <= 0) return { label: "Expired", color: "var(--danger)" };
  if (r.DaysRemaining <= 14) return { label: "Expiring Soon", color: "var(--warning)" };
  return { label: "Valid", color: "var(--success)" };
}

export function SslCertificatesClient() {
  const [rows, setRows] = useState<SslRow[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/monitoring/ssl-certificates")
      .then((r) => r.json())
      .then((d) => d.ok && setRows(d.data));
  }, []);

  return (
    <div className="dash-panel">
      {rows === null ? (
        <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--ink-muted)" }}>No HTTPS monitors checked yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ padding: "0.4rem" }}>Status</th>
                <th style={{ padding: "0.4rem" }}>Monitor</th>
                <th style={{ padding: "0.4rem" }}>Domain</th>
                <th style={{ padding: "0.4rem" }}>Issuer</th>
                <th style={{ padding: "0.4rem" }}>Expires</th>
                <th style={{ padding: "0.4rem" }}>Days Remaining</th>
                <th style={{ padding: "0.4rem" }}>TLS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const s = statusFor(r);
                return (
                  <tr key={r.MonitorId} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem", color: s.color, fontWeight: 600 }}>{s.label}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <Link href={`/dashboard/monitoring/websites/${r.MonitorId}`} style={{ color: "var(--series-1)" }}>
                        {r.MonitorName}
                      </Link>
                    </td>
                    <td style={{ padding: "0.4rem" }}>{r.Domain ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.Issuer ?? "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>{r.ExpiresAt ? new Date(r.ExpiresAt).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.DaysRemaining ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{r.TlsProtocol ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

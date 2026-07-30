"use client";

import { useState } from "react";
import { parseCidrLike, computeCidrInfo, splitIntoSubnets, type CidrInfo, type SubnetSplitResult } from "@/lib/utilities/cidr";

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
  fontFamily: "monospace",
};

export default function SubnetCalculatorForm() {
  const [input, setInput] = useState("192.168.1.0/24");
  const [subnetCount, setSubnetCount] = useState(4);
  const [base, setBase] = useState<CidrInfo | null>(null);
  const [split, setSplit] = useState<SubnetSplitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    setError(null);
    setSplit(null);
    try {
      const { ip, prefix } = parseCidrLike(input);
      setBase(computeCidrInfo(ip, prefix));
    } catch (err) {
      setBase(null);
      setError(err instanceof Error ? err.message : "Invalid input.");
    }
  }

  function divide() {
    setError(null);
    try {
      const { ip, prefix } = parseCidrLike(input);
      setBase(computeCidrInfo(ip, prefix));
      setSplit(splitIntoSubnets(ip, prefix, subnetCount));
    } catch (err) {
      setSplit(null);
      setError(err instanceof Error ? err.message : "Invalid input.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 240px" }}>
          <label htmlFor="net">Network (CIDR or IP + mask)</label>
          <input id="net" value={input} onChange={(e) => setInput(e.target.value)} style={inputStyle} placeholder="192.168.1.0/24" />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "0 1 160px" }}>
          <label htmlFor="count">Subnets needed</label>
          <input
            id="count"
            type="number"
            min={1}
            value={subnetCount}
            onChange={(e) => setSubnetCount(Number(e.target.value))}
            style={inputStyle}
          />
        </div>
        <button className="submit" type="button" onClick={calculate} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Show Network Info
        </button>
        <button className="submit" type="button" onClick={divide} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Split Into Subnets
        </button>
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {base && (
        <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>
          <code>{base.input}</code> → network <code>{base.networkAddress}</code>, mask <code>{base.netmask}</code>, {base.usableHosts} usable
          hosts
        </div>
      )}

      {split && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <div style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            Split /{split.originalPrefix} into {split.subnets.length} subnets of /{split.newPrefix} each
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>#</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Network</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Range</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Broadcast</th>
                <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Usable Hosts</th>
              </tr>
            </thead>
            <tbody>
              {split.subnets.map((s, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{i + 1}</td>
                  <td style={{ padding: "0.4rem 0.5rem", fontFamily: "monospace" }}>{s.input}</td>
                  <td style={{ padding: "0.4rem 0.5rem", fontFamily: "monospace" }}>
                    {s.firstHost} - {s.lastHost}
                  </td>
                  <td style={{ padding: "0.4rem 0.5rem", fontFamily: "monospace" }}>{s.broadcastAddress}</td>
                  <td style={{ padding: "0.4rem 0.5rem" }}>{s.usableHosts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

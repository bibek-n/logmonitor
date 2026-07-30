"use client";

import { useState } from "react";
import { parseCidrLike, computeCidrInfo, type CidrInfo } from "@/lib/utilities/cidr";

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

const ROWS: [keyof CidrInfo, string][] = [
  ["input", "Input"],
  ["networkAddress", "Network Address"],
  ["broadcastAddress", "Broadcast Address"],
  ["netmask", "Subnet Mask"],
  ["wildcardMask", "Wildcard Mask"],
  ["firstHost", "First Usable Host"],
  ["lastHost", "Last Usable Host"],
  ["totalAddresses", "Total Addresses"],
  ["usableHosts", "Usable Hosts"],
  ["ipClass", "IP Class"],
  ["isPrivate", "Private Range"],
];

export default function CidrCalculatorForm() {
  const [input, setInput] = useState("192.168.1.0/24");
  const [info, setInfo] = useState<CidrInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  function calculate() {
    setError(null);
    try {
      const { ip, prefix } = parseCidrLike(input);
      setInfo(computeCidrInfo(ip, prefix));
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : "Invalid input.");
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
          <label htmlFor="cidr">CIDR Notation</label>
          <input id="cidr" value={input} onChange={(e) => setInput(e.target.value)} style={inputStyle} placeholder="192.168.1.0/24" />
        </div>
        <button className="submit" type="button" onClick={calculate} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Calculate
        </button>
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {info && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {ROWS.map(([key, label]) => (
                <tr key={key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", color: "var(--ink-muted)", whiteSpace: "nowrap" }}>{label}</td>
                  <td style={{ padding: "0.5rem 0", fontFamily: "monospace" }}>
                    {key === "isPrivate" ? (info[key] ? "Yes" : "No") : String(info[key])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

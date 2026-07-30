"use client";

import { useState } from "react";
import { computeAllHashes, type HashAlgorithm } from "@/lib/utilities/hash";

const textareaStyle = {
  width: "100%",
  minHeight: 120,
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.9rem",
  resize: "vertical" as const,
};

export default function HashGeneratorForm() {
  const [input, setInput] = useState("");
  const [hashes, setHashes] = useState<Record<HashAlgorithm, string> | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      setHashes(await computeAllHashes(input));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dash-panel">
      <div className="field" style={{ marginBottom: "0.9rem" }}>
        <label htmlFor="input">Text</label>
        <textarea id="input" value={input} onChange={(e) => setInput(e.target.value)} style={textareaStyle} />
      </div>

      <button className="submit" type="button" onClick={run} disabled={loading} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
        {loading ? "Hashing..." : "Generate Hashes"}
      </button>

      {hashes && (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <tbody>
              {(Object.entries(hashes) as [HashAlgorithm, string][]).map(([algo, value]) => (
                <tr key={algo} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem 0.5rem 0", fontWeight: 600, whiteSpace: "nowrap", verticalAlign: "top" }}>{algo}</td>
                  <td style={{ padding: "0.5rem 0", fontFamily: "monospace", wordBreak: "break-all" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

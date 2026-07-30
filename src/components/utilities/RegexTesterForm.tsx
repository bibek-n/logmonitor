"use client";

import { useMemo, useState, type ReactNode } from "react";

const inputStyle = {
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
  fontFamily: "monospace",
};

const textareaStyle = {
  ...inputStyle,
  width: "100%",
  minHeight: 140,
  resize: "vertical" as const,
};

interface MatchInfo {
  match: string;
  index: number;
  groups: string[];
}

export default function RegexTesterForm() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState("g");
  const [testString, setTestString] = useState("");

  const { matches, error, highlighted } = useMemo(() => {
    if (!pattern) return { matches: [] as MatchInfo[], error: null as string | null, highlighted: testString };

    let regex: RegExp;
    try {
      const effectiveFlags = flags.includes("g") ? flags : flags + "g";
      regex = new RegExp(pattern, effectiveFlags);
    } catch (err) {
      return { matches: [] as MatchInfo[], error: err instanceof Error ? err.message : "Invalid regular expression.", highlighted: testString };
    }

    const found: MatchInfo[] = [];
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let iterations = 0;

    while ((m = regex.exec(testString)) !== null && iterations < 10000) {
      found.push({ match: m[0], index: m.index, groups: m.slice(1).map((g) => g ?? "") });
      parts.push(testString.slice(lastIndex, m.index));
      parts.push(
        <mark key={m.index} style={{ background: "var(--warning)", color: "#000", borderRadius: 2 }}>
          {m[0]}
        </mark>
      );
      lastIndex = m.index + (m[0].length || 1);
      if (m[0].length === 0) regex.lastIndex++;
      iterations++;
    }
    parts.push(testString.slice(lastIndex));

    return { matches: found, error: null, highlighted: parts };
  }, [pattern, flags, testString]);

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 320px" }}>
          <label htmlFor="pattern">Pattern</label>
          <input
            id="pattern"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
            placeholder="e.g. \\b\\w+@\\w+\\.\\w+\\b"
          />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
          <label htmlFor="flags">Flags</label>
          <input id="flags" value={flags} onChange={(e) => setFlags(e.target.value)} style={{ ...inputStyle, width: "100%" }} placeholder="gi" />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label htmlFor="testString">Test String</label>
        <textarea id="testString" value={testString} onChange={(e) => setTestString(e.target.value)} style={textareaStyle} />
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {!error && testString && (
        <div
          style={{
            marginTop: "1rem",
            background: "var(--plane)",
            padding: "1rem",
            borderRadius: 8,
            border: "1px solid var(--border)",
            fontFamily: "monospace",
            fontSize: "0.85rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {highlighted}
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <strong style={{ fontSize: "0.85rem" }}>
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </strong>
          <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>#</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Match</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Index</th>
                  <th style={{ textAlign: "left", padding: "0.4rem 0.5rem" }}>Groups</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{i + 1}</td>
                    <td style={{ padding: "0.4rem 0.5rem", fontFamily: "monospace" }}>{m.match}</td>
                    <td style={{ padding: "0.4rem 0.5rem" }}>{m.index}</td>
                    <td style={{ padding: "0.4rem 0.5rem", fontFamily: "monospace" }}>{m.groups.length ? m.groups.join(", ") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

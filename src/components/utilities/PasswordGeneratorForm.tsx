"use client";

import { useState } from "react";

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

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";
const AMBIGUOUS = new Set("Il1O0".split(""));

function generatePassword(length: number, sets: string[], excludeAmbiguous: boolean): string {
  let pool = sets.join("");
  if (excludeAmbiguous) pool = pool.split("").filter((c) => !AMBIGUOUS.has(c)).join("");
  if (!pool) throw new Error("Select at least one character set.");

  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => pool[v % pool.length]).join("");
}

function estimateStrength(length: number, setCount: number): { label: string; color: string } {
  const bits = length * Math.log2(Math.max(setCount * 20, 2));
  if (bits < 40) return { label: "Weak", color: "var(--danger)" };
  if (bits < 70) return { label: "Fair", color: "var(--warning)" };
  if (bits < 100) return { label: "Strong", color: "var(--success)" };
  return { label: "Very Strong", color: "var(--success)" };
}

export default function PasswordGeneratorForm() {
  const [length, setLength] = useState(16);
  const [useLower, setUseLower] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigits, setUseDigits] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    setError(null);
    setCopied(false);
    const sets = [useLower && LOWER, useUpper && UPPER, useDigits && DIGITS, useSymbols && SYMBOLS].filter(Boolean) as string[];
    try {
      setPassword(generatePassword(length, sets, excludeAmbiguous));
    } catch (err) {
      setPassword("");
      setError(err instanceof Error ? err.message : "Failed to generate password.");
    }
  }

  async function copy() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const setCount = [useLower, useUpper, useDigits, useSymbols].filter(Boolean).length;
  const strength = password ? estimateStrength(length, setCount) : null;

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", maxWidth: 480 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="length">Length: {length}</label>
          <input
            id="length"
            type="range"
            min={6}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.85rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={useLower} onChange={(e) => setUseLower(e.target.checked)} />
            Lowercase (a-z)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)} />
            Uppercase (A-Z)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={useDigits} onChange={(e) => setUseDigits(e.target.checked)} />
            Digits (0-9)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={useSymbols} onChange={(e) => setUseSymbols(e.target.checked)} />
            Symbols (!@#$...)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={excludeAmbiguous} onChange={(e) => setExcludeAmbiguous(e.target.checked)} />
            Exclude ambiguous characters (I, l, 1, O, 0)
          </label>
        </div>

        <button className="submit" type="button" onClick={generate} style={{ width: "auto", padding: "0.6rem 1.25rem" }}>
          Generate
        </button>
      </div>

      {error && (
        <div className="error" style={{ marginTop: "1rem" }}>
          {error}
        </div>
      )}

      {password && (
        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 480 }}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input id="password" value={password} readOnly style={inputStyle} />
            <button className="submit" type="button" onClick={copy} style={{ width: "auto", padding: "0.6rem 1rem" }}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {strength && (
            <span style={{ fontSize: "0.8rem", color: strength.color, fontWeight: 600 }}>Strength: {strength.label}</span>
          )}
        </div>
      )}
    </div>
  );
}

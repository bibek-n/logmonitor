"use client";

import { useState } from "react";
import QRCode from "qrcode";

const inputStyle = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.95rem",
};

const selectStyle = {
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--plane)",
  color: "var(--ink)",
  fontSize: "0.9rem",
};

export default function QrCodeGeneratorForm() {
  const [text, setText] = useState("");
  const [size, setSize] = useState(300);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    if (!text.trim()) {
      setError("Enter some text or a URL to encode.");
      setDataUrl(null);
      return;
    }
    try {
      const url = await QRCode.toDataURL(text, { width: size, margin: 2 });
      setDataUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate QR code.");
      setDataUrl(null);
    }
  }

  return (
    <div className="dash-panel">
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, flex: "1 1 300px" }}>
          <label htmlFor="text">Text or URL</label>
          <input id="text" value={text} onChange={(e) => setText(e.target.value)} style={inputStyle} placeholder="https://example.com" />
        </div>
        <div className="field" style={{ marginBottom: 0, flex: "0 1 140px" }}>
          <label htmlFor="size">Size (px)</label>
          <select id="size" value={size} onChange={(e) => setSize(Number(e.target.value))} style={selectStyle}>
            <option value={200}>200</option>
            <option value={300}>300</option>
            <option value={500}>500</option>
            <option value={800}>800</option>
          </select>
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

      {dataUrl && (
        <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.75rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="Generated QR code"
            style={{ width: size, height: size, borderRadius: 8, border: "1px solid var(--border)", background: "#fff" }}
          />
          <a href={dataUrl} download="qr-code.png" className="submit" style={{ width: "auto", padding: "0.5rem 1rem", textDecoration: "none" }}>
            Download PNG
          </a>
        </div>
      )}
    </div>
  );
}

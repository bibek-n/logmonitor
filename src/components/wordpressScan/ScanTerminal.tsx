"use client";

import { useEffect, useRef, useState, KeyboardEvent } from "react";

interface SavedWebsite {
  Id: number;
  Name: string;
  Url: string;
}

interface Props {
  savedWebsites: SavedWebsite[];
  onReportReady?: (scanId: number) => void;
}

const HELP_TEXT = [
  "WordPress Deep Scan — in-app CLI",
  "",
  "Usage:",
  "  scan wordpress <url>     Run a full deep scan against a URL",
  "  list                     List WordPress sites from your Websites list",
  "  clear                    Clear the terminal",
  "  help                     Show this message",
  "",
  "Example:",
  "  scan wordpress https://example.com",
];

// A lightweight in-browser terminal: no real shell behind it, just a scrolling output log
// + a command input that recognizes a small fixed command set and, for `scan wordpress`,
// streams live progress from /api/admin/wordpress-scan/cli line by line as each check runs.
export default function ScanTerminal({ savedWebsites, onReportReady }: Props) {
  const [lines, setLines] = useState<string[]>(["WordPress Deep Scan CLI — type `help` to get started."]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function print(...newLines: string[]) {
    setLines((prev) => [...prev, ...newLines]);
  }

  async function runScan(url: string) {
    setRunning(true);
    print(`$ scan wordpress ${url}`);

    let websiteId: number | null = null;
    const matched = savedWebsites.find((w) => w.Url === url);
    if (matched) websiteId = matched.Id;

    try {
      const res = await fetch("/api/admin/wordpress-scan/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, websiteId }),
      });

      function handleLine(part: string) {
        if (part.startsWith("__PROGRESS__")) {
          // Machine-readable-only marker for the Report tab's progress bar — the
          // terminal's scrolling log is already the progress indicator here.
          return;
        }
        if (part.startsWith("__REPORT__")) {
          try {
            const payload = JSON.parse(part.slice("__REPORT__".length));
            onReportReady?.(payload.scanId);
            print(`[i] Full report available in the "Report" tab (scan #${payload.scanId}).`);
          } catch {
            // Malformed sentinel line — ignore, the rest of the output already printed.
          }
          return;
        }
        if (part.length > 0) print(part);
      }

      if (!res.body) {
        const text = await res.text();
        text.split("\n").forEach(handleLine);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) handleLine(part);
      }
      if (buffer.length > 0) handleLine(buffer);
    } catch (err) {
      print(`[!] Connection error: ${err instanceof Error ? err.message : "request failed"}`);
    } finally {
      setRunning(false);
    }
  }

  async function handleCommand(raw: string) {
    const cmd = raw.trim();
    if (!cmd) return;
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(null);

    if (cmd === "help" || cmd === "-h" || cmd === "--help") {
      print(`$ ${cmd}`, ...HELP_TEXT);
      return;
    }
    if (cmd === "clear") {
      setLines([]);
      return;
    }
    if (cmd === "list") {
      print(
        `$ ${cmd}`,
        savedWebsites.length ? `Found ${savedWebsites.length} WordPress site(s):` : "No WordPress sites detected in your Websites list yet.",
        ...savedWebsites.map((w) => `  - ${w.Name}  (${w.Url})`)
      );
      return;
    }
    const scanMatch = /^scan\s+wordpress\s+(\S+)$/i.exec(cmd);
    if (scanMatch) {
      if (running) {
        print(`$ ${cmd}`, "[!] A scan is already running — wait for it to finish.");
        return;
      }
      await runScan(scanMatch[1]);
      return;
    }

    print(`$ ${cmd}`, `command not found: ${cmd.split(" ")[0]} — type "help" for usage`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = input;
      setInput("");
      void handleCommand(value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    }
  }

  return (
    <div
      style={{
        background: "#0b0f14",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: "0.82rem",
        color: "#d1f7c4",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "0.75rem 1rem", height: 360, overflowY: "auto" }}>
        {lines.map((line, i) => (
          <div key={i} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
            {line}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", padding: "0.5rem 1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <span style={{ marginRight: "0.5rem", color: "#7ee787" }}>$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={running}
          placeholder={running ? "scan running..." : "scan wordpress <url>"}
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#d1f7c4",
            fontFamily: "inherit",
            fontSize: "inherit",
          }}
        />
      </div>
    </div>
  );
}

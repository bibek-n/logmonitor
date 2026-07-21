"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunAutoCheckButton() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/compliance/run-auto-check", { method: "POST" });
      const body = await res.json();
      if (!body.ok) throw new Error(body.error ?? "Auto-check failed.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-check failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="submit"
        style={{ width: "auto", marginTop: 0, padding: "0.45rem 1rem", fontSize: "0.85rem", opacity: running ? 0.6 : 1 }}
      >
        {running ? "Running auto-checks..." : "Run Auto-Checks"}
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { TEST_RUN_STATUS_TONE, toneFor } from "@/lib/qaBadgeTones";
import type { BadgeTone } from "@/lib/qaBadgeTones";

interface ReleaseDetail {
  Id: number; ProjectId: number; Name: string; ReleaseDate: string | null; Status: string;
  ReleasedByUserId: number | null; ReleasedAt: string | null; CreatedAt: string;
}
interface LinkedRunRow { Id: number; TestRunNumber: string; Name: string; Status: string; QaApprovedAt: string | null }

const RELEASE_STATUS_TONE: Record<string, BadgeTone> = {
  Planned: "neutral", "In Progress": "info", Released: "success", Cancelled: "danger",
};
const STATUSES = ["Planned", "In Progress", "Released", "Cancelled"];

function Inner({
  release, projectName, testRuns, releasedByUsername, canManage,
}: {
  release: ReleaseDetail;
  projectName: string;
  testRuns: LinkedRunRow[];
  releasedByUsername: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [status, setStatus] = useState(release.Status);
  const [releasedAt, setReleasedAt] = useState(release.ReleasedAt);
  const [saving, setSaving] = useState(false);

  const eligibleRuns = testRuns.filter((r) => r.Status === "Completed" && r.QaApprovedAt);
  const canRelease = status !== "Released" && eligibleRuns.length > 0;

  async function updateStatus(next: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/qa/releases/${release.Id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update.");
      setStatus(next);
      if (next === "Released") setReleasedAt(new Date().toISOString());
      toast.show({ type: "success", message: next === "Released" ? "Released to production." : `Status set to ${next}.` });
      router.refresh();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: "0.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.4rem", margin: 0 }}>{release.Name}</h1>
        {canManage && status !== "Released" && (
          <Button
            size="sm"
            onClick={() => updateStatus("Released")}
            disabled={!canRelease || saving}
            title={!canRelease ? "Needs at least one Completed, QA-approved test run linked to this release." : undefined}
          >
            <Rocket size={13} /> {saving ? "Releasing..." : "Release to Production"}
          </Button>
        )}
      </div>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1.25rem" }}>{projectName}</p>

      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-2" style={{ flexWrap: "wrap" }}>
          <Badge tone={RELEASE_STATUS_TONE[status] ?? "neutral"}>{status}</Badge>
          {release.ReleaseDate && <span style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>Target: {release.ReleaseDate}</span>}
          {releasedAt && <span style={{ fontSize: "0.78rem", color: "var(--success)" }}>Released {new Date(releasedAt).toLocaleString()}{releasedByUsername ? ` by ${releasedByUsername}` : ""}</span>}
        </div>
        {canManage && status !== "Released" && (
          <div style={{ maxWidth: 200, marginTop: "0.5rem" }}>
            <Select value={status} onChange={updateStatus} options={STATUSES.filter((s) => s !== "Released").map((s) => ({ label: s, value: s }))} />
          </div>
        )}
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "0.95rem", margin: 0 }}>Test Runs ({testRuns.length})</h2>
        </div>
        {testRuns.length === 0 ? (
          <p style={{ padding: "1rem", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
            No test runs linked yet — assign this release to a test run when creating it.
          </p>
        ) : (
          <div className="flex flex-col">
            {testRuns.map((r) => (
              <Link
                key={r.Id}
                href={`/dashboard/qa/test-runs/${r.Id}`}
                className="flex items-center justify-between"
                style={{ padding: "0.6rem 1rem", borderBottom: "1px solid var(--border)", textDecoration: "none" }}
              >
                <span style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                  <span style={{ fontFamily: "monospace", color: "var(--ink-muted)", marginRight: 8 }}>{r.TestRunNumber}</span>
                  {r.Name}
                </span>
                <div className="flex items-center gap-2">
                  {r.QaApprovedAt && <Badge tone="success">QA Approved</Badge>}
                  <Badge tone={toneFor(TEST_RUN_STATUS_TONE, r.Status)}>{r.Status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export function ReleaseDetailClient(props: {
  release: ReleaseDetail; projectName: string; testRuns: LinkedRunRow[]; releasedByUsername: string | null; canManage: boolean;
}) {
  return (
    <ToastProvider>
      <Inner {...props} />
    </ToastProvider>
  );
}

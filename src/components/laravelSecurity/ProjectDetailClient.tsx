"use client";

import { useState } from "react";
import { Play, Pencil, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StartScanModal } from "./StartScanModal";
import { SecurityScoreBadge, ScanStatusBadge } from "./badges";

interface Project {
  Id: number;
  Name: string;
  Description: string | null;
  RepositoryUrl: string | null;
  SourcePath: string;
  DefaultBranch: string | null;
  LaravelVersion: string | null;
  Status: string;
  CreatedAt: string;
}

interface ScanRow {
  Id: number;
  Status: string;
  StartedAt: string | null;
  CompletedAt: string | null;
  SecurityScore: number | null;
  FilesScanned: number;
}

export function ProjectDetailClient({ project, recentScans, can }: { project: Project; recentScans: ScanRow[]; can: Record<string, boolean> }) {
  const router = useRouter();
  const [scanModalOpen, setScanModalOpen] = useState(false);

  return (
    <div className="flex flex-col" style={{ gap: "1rem" }}>
      <div className="flex items-center justify-between flex-wrap" style={{ gap: "0.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{project.Name}</h1>
          <p style={{ margin: "0.2rem 0 0", color: "var(--ink-muted)", fontSize: "0.85rem" }}>{project.Description || "No description."}</p>
        </div>
        <div className="flex items-center gap-2">
          {can.ls_scan_start && project.Status === "Active" && (
            <Button onClick={() => setScanModalOpen(true)}>
              <Play size={14} /> Start Scan
            </Button>
          )}
          {can.ls_project_update && (
            <Button variant="secondary" onClick={() => router.push(`/dashboard/laravel-security/projects/${project.Id}/edit`)}>
              <Pencil size={14} /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <Card style={{ padding: "0.9rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Source Path</div>
          <div style={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>{project.SourcePath}</div>
        </Card>
        <Card style={{ padding: "0.9rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Default Branch</div>
          <div>{project.DefaultBranch || "—"}</div>
        </Card>
        <Card style={{ padding: "0.9rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Laravel Version</div>
          {/* Read-only - detected automatically from composer.json/artisan during a scan (see
              runScan.ts). Never user-editable, so this never appears in ProjectFormClient. */}
          <div>{project.LaravelVersion ? <span style={{ fontFamily: "monospace" }}>{project.LaravelVersion}</span> : <span style={{ color: "var(--ink-muted)" }}>Not yet detected — run a scan</span>}</div>
        </Card>
        <Card style={{ padding: "0.9rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Status</div>
          <div style={{ color: project.Status === "Active" ? "var(--success)" : "var(--ink-muted)" }}>{project.Status}</div>
        </Card>
        {project.RepositoryUrl && (
          <Card style={{ padding: "0.9rem" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-muted)" }}>Repository</div>
            <a href={project.RepositoryUrl} target="_blank" rel="noreferrer noopener" style={{ color: "var(--primary)", fontSize: "0.85rem", wordBreak: "break-all" }}>
              {project.RepositoryUrl}
            </a>
          </Card>
        )}
      </div>

      <Card>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.95rem" }}>Recent Scans</h3>
          <Link href={`/dashboard/laravel-security/scans?projectId=${project.Id}`} className="flex items-center gap-1" style={{ color: "var(--primary)", fontSize: "0.8rem", textDecoration: "none" }}>
            <History size={13} /> View full history
          </Link>
        </div>
        {recentScans.length === 0 ? (
          <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem" }}>No scans yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Started</th>
                <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Status</th>
                <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Score</th>
                <th style={{ padding: "0.5rem 0.6rem", color: "var(--ink-muted)", fontWeight: 500 }}>Files</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((s) => (
                <tr key={s.Id} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => router.push(`/dashboard/laravel-security/scans/${s.Id}`)}>
                  <td style={{ padding: "0.5rem 0.6rem" }}>{s.StartedAt ? new Date(s.StartedAt).toLocaleString() : "—"}</td>
                  <td style={{ padding: "0.5rem 0.6rem" }}>
                    <ScanStatusBadge status={s.Status} />
                  </td>
                  <td style={{ padding: "0.5rem 0.6rem" }}>
                    <SecurityScoreBadge score={s.SecurityScore} />
                  </td>
                  <td style={{ padding: "0.5rem 0.6rem" }}>{s.FilesScanned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <StartScanModal
        projectId={project.Id}
        projectName={project.Name}
        defaultBranch={project.DefaultBranch}
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        onStarted={(scanId) => router.push(`/dashboard/laravel-security/scans/${scanId}`)}
      />
    </div>
  );
}

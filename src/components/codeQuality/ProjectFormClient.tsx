"use client";

import { useEffect, useState, FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { GitHubConnectModal } from "@/components/integrations/GitHubConnectModal";
import { GitLabConnectModal } from "@/components/integrations/GitLabConnectModal";
import { FolderBrowseModal } from "@/components/shared/FolderBrowseModal";

export interface ProjectFormValues {
  name: string;
  description: string;
  repositoryUrl: string;
  sourcePath: string;
  defaultBranch: string;
  language: string;
  status: "Active" | "Inactive";
  repoConnectionId: number | null;
  repoProvider: "GitHub" | "GitLab" | null;
  repositoryOwner: string; // GitHub: literal owner. GitLab: numeric project id as a string.
  repositoryName: string; // GitHub: repo name. GitLab: path_with_namespace.
  repositoryRef: string;
}

interface ConnectionSummary {
  Id: number;
  Provider: "GitHub" | "GitLab";
  Name: string;
  InstanceUrl: string | null;
  OwnerLogin: string | null;
}

interface RepoSummary {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string | null;
}

type SourceType = "local" | "github" | "gitlab";

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};
const labelStyle: React.CSSProperties = { fontSize: "0.78rem", color: "var(--ink-muted)", marginBottom: "0.3rem", display: "block" };
const sourceTabStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.5rem 1rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: active ? "var(--primary)" : "var(--surface-2)",
  color: active ? "#fff" : "var(--ink)",
  fontSize: "0.83rem",
  fontWeight: 600,
  cursor: "pointer",
});

function initialSourceType(initial?: Partial<ProjectFormValues>): SourceType {
  if (initial?.repoProvider === "GitHub") return "github";
  if (initial?.repoProvider === "GitLab") return "gitlab";
  return "local";
}

const ADD_PROJECT_RETURN_TO = "/dashboard/code-quality/projects/new";

export function ProjectFormClient({ projectId, initial }: { projectId?: number; initial?: Partial<ProjectFormValues> }) {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const isEdit = projectId !== undefined;

  const [form, setForm] = useState<ProjectFormValues>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    repositoryUrl: initial?.repositoryUrl ?? "",
    sourcePath: initial?.sourcePath ?? "",
    defaultBranch: initial?.defaultBranch ?? "main",
    language: initial?.language ?? "",
    status: initial?.status ?? "Active",
    repoConnectionId: initial?.repoConnectionId ?? null,
    repoProvider: initial?.repoProvider ?? null,
    repositoryOwner: initial?.repositoryOwner ?? "",
    repositoryName: initial?.repositoryName ?? "",
    repositoryRef: initial?.repositoryRef ?? "",
  });
  const [sourceType, setSourceType] = useState<SourceType>(initialSourceType(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [connections, setConnections] = useState<ConnectionSummary[]>([]);
  const [githubConnectModalOpen, setGithubConnectModalOpen] = useState(false);
  const [gitlabConnectModalOpen, setGitlabConnectModalOpen] = useState(false);
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [reposLoading, setReposLoading] = useState(false);
  const [browseModalOpen, setBrowseModalOpen] = useState(false);

  function loadConnections(selectId?: number) {
    fetch("/api/admin/integrations/git/connections")
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        setConnections(data.data);
        if (selectId) {
          const found = (data.data as ConnectionSummary[]).find((c) => c.Id === selectId);
          if (found) {
            setForm((f) => ({ ...f, repoConnectionId: selectId, repoProvider: found.Provider }));
          }
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadConnections();
    const connected = searchParams.get("gitConnected");
    const gitError = searchParams.get("gitError");
    if (connected) toast.show({ type: "success", message: `Connected "${connected}".` });
    if (gitError) toast.show({ type: "error", message: gitError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sourceType === "local" || !form.repoConnectionId) {
      setRepos([]);
      return;
    }
    setReposLoading(true);
    const handle = setTimeout(() => {
      fetch(`/api/admin/integrations/git/connections/${form.repoConnectionId}/repos${repoSearch ? `?search=${encodeURIComponent(repoSearch)}` : ""}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setRepos(data.data.repos);
        })
        .catch(() => {})
        .finally(() => setReposLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [sourceType, form.repoConnectionId, repoSearch]);

  function set<K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectRepo(repo: RepoSummary) {
    setForm((f) => ({ ...f, repositoryOwner: repo.owner, repositoryName: repo.name, repositoryRef: f.repositoryRef || repo.defaultBranch || "", defaultBranch: repo.defaultBranch || f.defaultBranch }));
  }

  const connectionsForCurrentTab = connections.filter((c) => (sourceType === "github" ? c.Provider === "GitHub" : sourceType === "gitlab" ? c.Provider === "GitLab" : false));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (sourceType !== "local" && (!form.repoConnectionId || !form.repositoryOwner || !form.repositoryName)) {
      setError(`Choose a ${sourceType === "github" ? "GitHub" : "GitLab"} connection and repository.`);
      return;
    }
    if (sourceType === "local" && !form.sourcePath.trim()) {
      setError("Enter a source path.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description || null,
        repositoryUrl: form.repositoryUrl || null,
        defaultBranch: form.defaultBranch || null,
        language: form.language || null,
        status: form.status,
      };
      if (sourceType !== "local") {
        body.repoConnectionId = form.repoConnectionId;
        body.repoProvider = form.repoProvider;
        body.repositoryOwner = form.repositoryOwner;
        body.repositoryName = form.repositoryName;
        if (form.repositoryRef) body.repositoryRef = form.repositoryRef;
      } else {
        body.sourcePath = form.sourcePath;
      }

      const res = await fetch(isEdit ? `/api/admin/code-quality/projects/${projectId}` : "/api/admin/code-quality/projects", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save project.");
      toast.show({ type: "success", message: isEdit ? "Project updated." : "Project created." });
      router.push(isEdit ? `/dashboard/code-quality/projects/${projectId}` : `/dashboard/code-quality/projects/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: "1rem", maxWidth: 640 }}>
      <h1 style={{ margin: 0, fontSize: "1.4rem" }}>{isEdit ? "Edit Project" : "Add Project"}</h1>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && <div style={{ padding: "0.6rem 0.8rem", borderRadius: 8, background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", fontSize: "0.82rem" }}>{error}</div>}

          <div>
            <label style={labelStyle}>Project Name</label>
            <input style={fieldStyle} value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...fieldStyle, resize: "vertical", minHeight: 70 }} value={form.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} />
          </div>

          <div>
            <label style={labelStyle}>Source</label>
            <div className="flex gap-2" style={{ marginBottom: "0.6rem" }}>
              <button type="button" style={sourceTabStyle(sourceType === "local")} onClick={() => setSourceType("local")}>Local Path</button>
              <button type="button" style={sourceTabStyle(sourceType === "github")} onClick={() => { setSourceType("github"); set("repoProvider", "GitHub"); }}>GitHub Repository</button>
              <button type="button" style={sourceTabStyle(sourceType === "gitlab")} onClick={() => { setSourceType("gitlab"); set("repoProvider", "GitLab"); }}>GitLab Repository</button>
            </div>

            {sourceType === "local" && (
              <div>
                <label style={labelStyle}>Source Path (must be inside an approved scan root on the server)</label>
                <div className="flex gap-2">
                  <input style={{ ...fieldStyle, fontFamily: "monospace" }} value={form.sourcePath} onChange={(e) => set("sourcePath", e.target.value)} placeholder="D:\WWWROOT\LogMonitor" />
                  <Button type="button" variant="ghost" onClick={() => setBrowseModalOpen(true)}>Browse…</Button>
                </div>
              </div>
            )}

            {sourceType !== "local" && (
              <div className="flex flex-col gap-3">
                <div>
                  <label style={labelStyle}>{sourceType === "github" ? "GitHub" : "GitLab"} Connection</label>
                  <div className="flex gap-2">
                    <select
                      style={fieldStyle}
                      value={form.repoConnectionId ?? ""}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : null;
                        const found = connections.find((c) => c.Id === id);
                        setForm((f) => ({ ...f, repoConnectionId: id, repoProvider: found?.Provider ?? f.repoProvider }));
                      }}
                    >
                      <option value="">Select a connection…</option>
                      {connectionsForCurrentTab.map((c) => (
                        <option key={c.Id} value={c.Id}>{c.Name}{c.OwnerLogin ? ` (${c.OwnerLogin})` : ""}{c.InstanceUrl ? ` — ${c.InstanceUrl}` : ""}</option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => (sourceType === "github" ? setGithubConnectModalOpen(true) : setGitlabConnectModalOpen(true))}
                    >
                      + Connect
                    </Button>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
                    Manage all connections in <a href="/dashboard/settings/integrations/git" style={{ color: "var(--primary)" }}>Git Connections</a>.
                  </p>
                </div>

                {form.repoConnectionId && (
                  <div>
                    <label style={labelStyle}>{sourceType === "github" ? "Repository" : "Project"}</label>
                    <input
                      style={{ ...fieldStyle, marginBottom: "0.4rem" }}
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder={sourceType === "github" ? "Search repositories…" : "Search projects…"}
                    />
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                      {reposLoading ? (
                        <div style={{ padding: "0.6rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>Loading…</div>
                      ) : repos.length === 0 ? (
                        <div style={{ padding: "0.6rem", fontSize: "0.8rem", color: "var(--ink-muted)" }}>None found.</div>
                      ) : (
                        repos.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => selectRepo(r)}
                            className="flex items-center justify-between w-full"
                            style={{
                              padding: "0.5rem 0.7rem",
                              background: form.repositoryOwner === r.owner && form.repositoryName === r.name ? "color-mix(in srgb, var(--primary) 12%, transparent)" : "transparent",
                              border: "none",
                              borderBottom: "1px solid var(--border)",
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: "0.82rem",
                              color: "var(--ink)",
                            }}
                          >
                            <span>{r.fullName}</span>
                            {r.private && <span style={{ fontSize: "0.7rem", color: "var(--ink-muted)" }}>Private</span>}
                          </button>
                        ))
                      )}
                    </div>
                    {form.repositoryOwner && form.repositoryName && (
                      <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.4rem" }}>
                        Selected: <strong>{sourceType === "github" ? `${form.repositoryOwner}/${form.repositoryName}` : form.repositoryName}</strong>
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Branch / Ref (defaults to the default branch)</label>
                  <input style={fieldStyle} value={form.repositoryRef} onChange={(e) => set("repositoryRef", e.target.value)} placeholder={form.defaultBranch || "main"} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>Repository URL (optional, for reference only)</label>
            <input style={fieldStyle} value={form.repositoryUrl} onChange={(e) => set("repositoryUrl", e.target.value)} placeholder="https://github.com/org/repo" />
          </div>

          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={labelStyle}>Default Branch</label>
              <input style={fieldStyle} value={form.defaultBranch} onChange={(e) => set("defaultBranch", e.target.value)} placeholder="main" disabled={sourceType !== "local"} />
            </div>
            <div>
              <label style={labelStyle}>Programming Language</label>
              <input style={fieldStyle} value={form.language} onChange={(e) => set("language", e.target.value)} placeholder="TypeScript" />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select style={fieldStyle} value={form.status} onChange={(e) => set("status", e.target.value as "Active" | "Inactive")}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2" style={{ marginTop: "0.5rem" }}>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Project"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <GitHubConnectModal
        open={githubConnectModalOpen}
        onClose={() => setGithubConnectModalOpen(false)}
        onConnected={(id) => {
          setGithubConnectModalOpen(false);
          loadConnections(id);
        }}
        returnTo={ADD_PROJECT_RETURN_TO}
      />

      <GitLabConnectModal
        open={gitlabConnectModalOpen}
        onClose={() => setGitlabConnectModalOpen(false)}
        onConnected={(id) => {
          setGitlabConnectModalOpen(false);
          loadConnections(id);
        }}
      />

      <FolderBrowseModal
        open={browseModalOpen}
        onClose={() => setBrowseModalOpen(false)}
        onSelect={(selectedPath) => {
          set("sourcePath", selectedPath);
          setBrowseModalOpen(false);
        }}
        apiPath="/api/admin/code-quality/browse-folders"
      />
    </div>
  );
}

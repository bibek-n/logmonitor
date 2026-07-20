"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2, GitFork, GitBranch } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { GitHubConnectModal } from "@/components/integrations/GitHubConnectModal";
import { GitLabConnectModal } from "@/components/integrations/GitLabConnectModal";

interface ConnectionRow {
  Id: number;
  Provider: "GitHub" | "GitLab";
  Name: string;
  AuthMethod: "PAT" | "OAuthApp" | "GitHubApp";
  InstanceUrl: string | null;
  OwnerLogin: string | null;
  CreatedAt: string;
}

const AUTH_METHOD_LABEL: Record<string, string> = { PAT: "Personal Access Token", OAuthApp: "OAuth App", GitHubApp: "GitHub App" };

export function GitConnectionsClient({ canManage }: { canManage: boolean }) {
  const toast = useToast();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [gitlabModalOpen, setGitlabModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ConnectionRow | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/integrations/git/connections")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setConnections(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const connected = searchParams.get("gitConnected");
    const gitError = searchParams.get("gitError");
    if (connected) toast.show({ type: "success", message: `Connected "${connected}".` });
    if (gitError) toast.show({ type: "error", message: gitError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/integrations/git/connections/${deleteTarget.Id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to remove connection.");
      toast.show({ type: "success", message: "Connection removed." });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to remove connection." });
    }
  }

  return (
    <div className="flex flex-col" style={{ gap: "1rem", maxWidth: 720 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: "1.4rem" }}>Git Connections</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginTop: "0.3rem" }}>
          Connect GitHub and GitLab accounts once here - any module that scans a repository (Code Quality, Laravel Security, and
          future ones) can pick from these same connections instead of reconnecting per module.
        </p>
      </div>

      {canManage && (
        <div className="flex gap-2">
          <Button type="button" onClick={() => setGithubModalOpen(true)}>+ Connect GitHub</Button>
          <Button type="button" variant="ghost" onClick={() => setGitlabModalOpen(true)}>+ Connect GitLab</Button>
        </div>
      )}

      <Card>
        {loading ? (
          <div style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>Loading…</div>
        ) : connections.length === 0 ? (
          <div style={{ padding: "1rem", fontSize: "0.85rem", color: "var(--ink-muted)" }}>No connections yet.</div>
        ) : (
          <div className="flex flex-col">
            {connections.map((c) => (
              <div
                key={c.Id}
                className="flex items-center justify-between"
                style={{ padding: "0.75rem 0.9rem", borderBottom: "1px solid var(--border)" }}
              >
                <div className="flex items-center gap-3">
                  {c.Provider === "GitHub" ? <GitFork size={18} /> : <GitBranch size={18} />}
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>{c.Name}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--ink-muted)" }}>
                      {AUTH_METHOD_LABEL[c.AuthMethod]}
                      {c.InstanceUrl ? ` · ${c.InstanceUrl}` : ""}
                      {c.OwnerLogin ? ` · ${c.OwnerLogin}` : ""}
                    </div>
                  </div>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(c)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 6 }}
                    aria-label="Remove connection"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <GitHubConnectModal
        open={githubModalOpen}
        onClose={() => setGithubModalOpen(false)}
        onConnected={() => {
          setGithubModalOpen(false);
          load();
        }}
        returnTo="/dashboard/settings/integrations/git"
      />
      <GitLabConnectModal
        open={gitlabModalOpen}
        onClose={() => setGitlabModalOpen(false)}
        onConnected={() => {
          setGitlabModalOpen(false);
          load();
        }}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove Connection"
        message={`Remove "${deleteTarget?.Name}"? Any project still pointing at it will fail to sync until repointed.`}
        confirmLabel="Remove"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

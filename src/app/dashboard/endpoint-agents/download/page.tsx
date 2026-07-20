import { Monitor, Terminal, Download as DownloadIcon, AlertTriangle } from "lucide-react";
import { getAdminSession } from "@/lib/requireAdmin";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AGENT_REPO as REPO, getLatestAgentRelease, findReleaseAsset, type ReleaseAsset } from "@/lib/agentRelease";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AssetCard({
  icon: Icon,
  title,
  sub,
  asset,
  fallbackName,
}: {
  icon: typeof Monitor;
  title: string;
  sub: string;
  asset: ReleaseAsset | undefined;
  fallbackName: string;
}) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon size={18} style={{ color: "var(--primary)" }} />
        <span style={{ fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-muted)" }}>{sub}</div>
      {asset ? (
        <>
          <div style={{ fontSize: "0.72rem", color: "var(--ink-secondary)" }}>{formatBytes(asset.size)}</div>
          <a href={asset.browser_download_url}>
            <Button size="sm" style={{ width: "100%" }}>
              <DownloadIcon size={13} /> Download
            </Button>
          </a>
        </>
      ) : (
        <>
          <Badge tone="warning">Not published yet</Badge>
          <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", margin: 0 }}>
            Expected asset: <code>{fallbackName}</code>. Check the{" "}
            <a href={`https://github.com/${REPO}/actions`} style={{ color: "var(--primary)" }}>
              Actions tab
            </a>{" "}
            — the release build may still be running.
          </p>
        </>
      )}
    </Card>
  );
}

export default async function DownloadAgentPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Download Agent</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can download the endpoint agent.</p>
      </div>
    );
  }

  const release = await getLatestAgentRelease();
  const findAsset = (name: string) => findReleaseAsset(release, name);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Download Agent</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "0.5rem" }}>
        {release ? (
          <>
            Latest published version: <strong>{release.tag_name}</strong>
          </>
        ) : (
          "No release has been published yet."
        )}{" "}
        After downloading, get a one-time enrollment token from the{" "}
        <a href="/dashboard/endpoint-agents/enroll" style={{ color: "var(--primary)" }}>
          Enroll Device
        </a>{" "}
        page to complete installation.
      </p>

      <div
        className="flex items-center gap-2 mb-4"
        style={{
          background: "color-mix(in srgb, var(--warning) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
          borderRadius: 10,
          padding: "0.6rem 0.85rem",
          fontSize: "0.78rem",
          color: "var(--ink)",
        }}
      >
        <AlertTriangle size={14} style={{ color: "var(--warning)", flexShrink: 0 }} />
        The Windows build is unsigned for now — Windows SmartScreen will show a warning until a code-signing
        certificate is added to the release pipeline.
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <AssetCard
          icon={Monitor}
          title="Windows (amd64)"
          sub="Run as administrator: agent.exe install --token=... --server=..."
          asset={findAsset("agent.exe")}
          fallbackName="agent.exe"
        />
        <AssetCard
          icon={Terminal}
          title="Linux (amd64)"
          sub="Used automatically by install.sh on x86_64 hosts"
          asset={findAsset("logmonitor-agent-linux-amd64")}
          fallbackName="logmonitor-agent-linux-amd64"
        />
        <AssetCard
          icon={Terminal}
          title="Linux (arm64)"
          sub="Used automatically by install.sh on aarch64 hosts"
          asset={findAsset("logmonitor-agent-linux-arm64")}
          fallbackName="logmonitor-agent-linux-arm64"
        />
      </div>

      <Card className="mt-4">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: "0.5rem" }}>Linux one-line install</h2>
        <pre
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.75rem",
            fontSize: "0.78rem",
            overflowX: "auto",
            margin: 0,
          }}
        >
          {`curl -fsSL https://raw.githubusercontent.com/${REPO}/main/agent/install.sh | sudo TOKEN=<TOKEN> SERVER_URL=<SERVER_URL> bash`}
        </pre>
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginBottom: 0 }}>
          This downloads the matching architecture automatically — no manual selection needed.
        </p>
      </Card>

      <Card className="mt-4 flex flex-col gap-2">
        <h2 style={{ fontSize: "0.95rem", marginTop: 0, marginBottom: 0 }}>Removing an installed agent</h2>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
          <strong>Windows</strong> (as administrator, using the same <code>agent.exe</code> you installed with):
        </p>
        <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: "0.78rem", margin: 0 }}>
          agent.exe uninstall
        </pre>
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", margin: 0 }}>
          Stops and removes the service and its config folder. The .exe itself is left in place (Windows locks a
          running executable) — delete it by hand once the command finishes.
        </p>
        <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", margin: 0 }}>
          <strong>Linux</strong> (as root):
        </p>
        <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem", fontSize: "0.78rem", margin: 0 }}>
          sudo /usr/local/bin/logmonitor-agent uninstall
        </pre>
        <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", margin: 0 }}>
          One command: stops and disables the systemd unit, removes the unit file, deletes its config directory, and
          removes the binary. Requires v0.4.1 or later — older versions don't support uninstall on Linux.
        </p>
      </Card>
    </div>
  );
}

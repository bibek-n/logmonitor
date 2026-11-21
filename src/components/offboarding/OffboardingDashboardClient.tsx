"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Mail, Bot, MessagesSquare, Monitor, Network } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToastProvider, useToast } from "@/components/ui/Toast";

// No real brand logos are available (lucide-react ships generic icons only, and the niche ones
// here - AgentQA, teamwork.websearchpro.net's internal instance - have no entry in any icon set
// anyway), so these are semantic stand-ins, not wordmarks. Colored (roughly matching each real
// product's brand color where one exists - GitLab's orange, Microsoft/AD's blue) so the six
// columns stay visually distinct at a glance instead of blending into the same muted gray.
const SYSTEM_COLORS = {
  gitlab: "#FC6D26",
  glesys: "#2563EB",
  agentqa: "#8B5CF6",
  teamwork: "#0D9488",
  logmonitor: "#DC2626",
  activeDirectory: "#0078D4",
} as const;

function systemIconProps(color: string) {
  return { size: 13, color, style: { verticalAlign: "-2px", marginRight: "0.3rem" } } as const;
}

interface Employee {
  id: number;
  name: string;
  email: string | null;
  department: string | null;
  employmentStatus: string;
  gitlabUsername: string | null;
  gitlabUserId: number | null;
  glesysMailbox: string | null;
  agentQaUserId: string | null;
  teamworkEmail: string | null;
  logMonitorUsername: string | null;
  adUsername: string | null;
  offboardingDate: string | null;
  gitlabStatus: string | null;
  glesysStatus: string | null;
  agentQaStatus: string | null;
  teamworkStatus: string | null;
  logMonitorStatus: string | null;
  activeDirectoryStatus: string | null;
  overallStatus: string | null;
  lastActionAt: string | null;
}

interface GitLabUserOption {
  id: number;
  username: string;
  name: string;
  email: string | null;
  state: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.45rem 0.6rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  Success: "success",
  Complete: "success",
  Failed: "danger",
  ManualActionRequired: "warning",
  PartiallyComplete: "warning",
  Pending: "neutral",
  Skipped: "neutral",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge tone="neutral">Not started</Badge>;
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status}</Badge>;
}

function MappingModal({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [gitlabQuery, setGitlabQuery] = useState(employee.gitlabUsername ?? "");
  const [gitlabOptions, setGitlabOptions] = useState<GitLabUserOption[]>([]);
  const [selectedGitlab, setSelectedGitlab] = useState<GitLabUserOption | null>(
    employee.gitlabUserId && employee.gitlabUsername ? { id: employee.gitlabUserId, username: employee.gitlabUsername, name: "", email: null, state: "" } : null
  );
  const [searching, setSearching] = useState(false);
  const [glesysMailbox, setGlesysMailbox] = useState(employee.glesysMailbox ?? "");
  const [agentQaUserId, setAgentQaUserId] = useState(employee.agentQaUserId ?? "");
  const [teamworkEmail, setTeamworkEmail] = useState(employee.teamworkEmail ?? "");
  const [logMonitorUsername, setLogMonitorUsername] = useState(employee.logMonitorUsername ?? "");
  const [adUsername, setAdUsername] = useState(employee.adUsername ?? "");
  const [offboardingDate, setOffboardingDate] = useState(employee.offboardingDate ?? "");
  const [saving, setSaving] = useState(false);

  async function searchGitlab() {
    if (!gitlabQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/offboarding/gitlab-search?q=${encodeURIComponent(gitlabQuery.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "GitLab search failed." });
        return;
      }
      setGitlabOptions(data.data);
    } finally {
      setSearching(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/offboarding/employees/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gitlabUsername: selectedGitlab?.username ?? null,
          gitlabUserId: selectedGitlab?.id ?? null,
          glesysMailbox: glesysMailbox.trim() || null,
          agentQaUserId: agentQaUserId.trim() || null,
          teamworkEmail: teamworkEmail.trim() || null,
          logMonitorUsername: logMonitorUsername.trim() || null,
          adUsername: adUsername.trim() || null,
          offboardingDate: offboardingDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Save failed." });
        return;
      }
      toast.show({ type: "success", message: "Mapping saved." });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Map accounts - ${employee.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>GitLab account</label>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input
              value={gitlabQuery}
              onChange={(e) => setGitlabQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchGitlab()}
              placeholder="Search by name, username, or email..."
              style={inputStyle}
            />
            <Button size="sm" variant="secondary" onClick={searchGitlab} disabled={searching}>
              {searching ? "..." : "Search"}
            </Button>
          </div>
          {selectedGitlab && (
            <p style={{ fontSize: "0.8rem", marginTop: "0.4rem", color: "var(--ink)" }}>
              Selected: <strong>{selectedGitlab.username}</strong> (user #{selectedGitlab.id})
            </p>
          )}
          {gitlabOptions.length > 0 && (
            <div style={{ marginTop: "0.4rem", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 180, overflowY: "auto" }}>
              {gitlabOptions.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    setSelectedGitlab(u);
                    setGitlabOptions([]);
                    setGitlabQuery(u.username);
                  }}
                  style={{ padding: "0.4rem 0.6rem", cursor: "pointer", borderBottom: "1px solid var(--grid)", fontSize: "0.82rem" }}
                >
                  {u.name} (@{u.username}) {u.email ? `- ${u.email}` : ""}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>Glesys mailbox</label>
          <input value={glesysMailbox} onChange={(e) => setGlesysMailbox(e.target.value)} placeholder="jane.doe@company.com" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>
            AgentQA override <span style={{ color: "var(--ink-muted)", fontWeight: "normal" }}>(optional)</span>
          </label>
          <input value={agentQaUserId} onChange={(e) => setAgentQaUserId(e.target.value)} placeholder="Leave blank to match by Office Email" style={inputStyle} />
          <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
            Leave blank - AgentQA matches by login email automatically using Office Email above. Only fill this in if
            their AgentQA login uses a different email, or if you have their actual AgentQA UUID; don&apos;t repeat
            the same email here.
          </p>
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>
            Teamwork email <span style={{ color: "var(--ink-muted)", fontWeight: "normal" }}>(optional)</span>
          </label>
          <input value={teamworkEmail} onChange={(e) => setTeamworkEmail(e.target.value)} placeholder="Leave blank to match by Office Email" style={inputStyle} />
          <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
            Leave blank to use Office Email above - only set this if their Teamwork login uses a
            different email.
          </p>
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>
            LogMonitor username <span style={{ color: "var(--ink-muted)", fontWeight: "normal" }}>(optional)</span>
          </label>
          <input value={logMonitorUsername} onChange={(e) => setLogMonitorUsername(e.target.value)} placeholder="Leave blank to match by Office Email" style={inputStyle} />
          <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
            Leave blank - this employee&apos;s own LogMonitor login (if any) is matched by Office Email above. Only fill
            this in if their LogMonitor username differs from their email. Your own signed-in account is never disabled
            through this feature.
          </p>
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>
            Active Directory username (sAMAccountName)
          </label>
          <input value={adUsername} onChange={(e) => setAdUsername(e.target.value)} placeholder="e.g. bibek" style={inputStyle} />
          <p style={{ fontSize: "0.72rem", color: "var(--ink-muted)", marginTop: "0.25rem" }}>
            Required - this is the employee&apos;s real Windows/VPN domain login, not their office email, and there&apos;s
            no safe way to guess it automatically. Leaving this blank skips Active Directory entirely for this employee.
          </p>
        </div>
        <div>
          <label style={{ fontSize: "0.78rem", color: "var(--ink-muted)", display: "block", marginBottom: "0.3rem" }}>Offboarding date</label>
          <input type="date" value={offboardingDate} onChange={(e) => setOffboardingDate(e.target.value)} style={inputStyle} />
        </div>
      </div>
    </Modal>
  );
}

function RevealGlesysPasswordModal({ employeeId, actionId, onClose }: { employeeId: number; actionId: number; onClose: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/offboarding/employees/${employeeId}/actions/${actionId}/reveal-glesys-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Could not reveal the password." });
        return;
      }
      setRevealed(data.data.password);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Reveal mailbox password for handoff" footer={!revealed && <Button onClick={reveal} disabled={loading || !password}>{loading ? "Verifying..." : "Reveal"}</Button>}>
      {revealed ? (
        <div>
          <p style={{ fontSize: "0.85rem" }}>Give this to the employee&apos;s manager - it is not shown again after you close this dialog.</p>
          <code style={{ display: "block", padding: "0.6rem", background: "var(--surface-2)", borderRadius: 8, fontSize: "0.9rem", wordBreak: "break-all" }}>{revealed}</code>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "0.85rem", marginBottom: "0.6rem" }}>Confirm your own password to reveal this mailbox&apos;s new credential.</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reveal()}
            placeholder="Your password"
            style={inputStyle}
          />
        </div>
      )}
    </Modal>
  );
}

function ConfirmModal({
  employee,
  onClose,
  onConfirmed,
}: {
  employee: Employee;
  onClose: () => void;
  onConfirmed: (result: {
    actionId: number;
    gitlabStatus: string;
    glesysStatus: string;
    agentQaStatus: string;
    teamworkStatus: string;
    logMonitorStatus: string;
    activeDirectoryStatus: string;
    overallStatus: string;
    gitlabDetail: string | null;
    glesysDetail: string | null;
    agentQaDetail: string | null;
    teamworkDetail: string | null;
    logMonitorDetail: string | null;
    activeDirectoryDetail: string | null;
  }) => void;
}) {
  const toast = useToast();
  const [running, setRunning] = useState(false);

  async function confirm() {
    setRunning(true);
    try {
      const res = await fetch(`/api/admin/offboarding/employees/${employee.id}/disable-all`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.show({ type: "error", message: data.error ?? "Offboarding failed to run." });
        return;
      }
      onConfirmed(data.data);
      onClose();
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Confirm: Disable All"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={running}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={running}>
            {running ? "Running..." : "Disable All"}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: "0.9rem" }}>
        You are about to revoke access for <strong>{employee.name}</strong>.
      </p>
      <ul style={{ fontSize: "0.85rem", color: "var(--ink-muted)", marginTop: "0.6rem", paddingLeft: "1.2rem" }}>
        <li>GitLab: {employee.gitlabUsername ? <>block user <strong>@{employee.gitlabUsername}</strong> and revoke their personal access tokens</> : <em>not mapped - will be skipped</em>}</li>
        <li>Glesys Email: {employee.glesysMailbox ? <>reset the login password for <strong>{employee.glesysMailbox}</strong> (mailbox and mail are kept)</> : <em>not mapped - will be skipped</em>}</li>
        <li>
          AgentQA:{" "}
          {employee.agentQaUserId || employee.email ? (
            <>
              disable sign-in for <strong>{employee.agentQaUserId ?? employee.email}</strong>
            </>
          ) : (
            <em>no email or AgentQA id - will be skipped</em>
          )}
        </li>
        <li>
          Teamwork:{" "}
          {employee.teamworkEmail || employee.email ? (
            <>
              disable sign-in for <strong>{employee.teamworkEmail ?? employee.email}</strong> on Teamwork
            </>
          ) : (
            <em>no email or Teamwork override - will be skipped</em>
          )}
        </li>
        <li>
          LogMonitor (this app):{" "}
          {employee.logMonitorUsername || employee.email ? (
            <>
              deactivate the LogMonitor login for <strong>{employee.logMonitorUsername ?? employee.email}</strong>, if one exists
            </>
          ) : (
            <em>no email or LogMonitor username - will be skipped</em>
          )}
        </li>
        <li>
          Active Directory (domain/VPN login):{" "}
          {employee.adUsername ? (
            <>
              disable the Windows domain account <strong>{employee.adUsername}</strong>
            </>
          ) : (
            <em>no AD username mapped - will be skipped</em>
          )}
        </li>
      </ul>
      <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", marginTop: "0.6rem" }}>
        Neither account nor its data is deleted. This can be retried safely if anything fails. GitLab is reversible via its own
        unblock; Glesys via a fresh password; AgentQA by re-enabling. Teamwork&apos;s disable is reversible in principle but no
        restore endpoint is documented yet, so re-enabling there currently needs a manual step on Teamwork&apos;s side. LogMonitor
        is reversible any time from Users and Access - and this will never disable your own account or the last remaining Admin.
        Active Directory is reversible any time by an AD administrator, but is also the most consequential item here - it blocks
        this person&apos;s real Windows/VPN login domain-wide.
      </p>
    </Modal>
  );
}

function DashboardInner() {
  const toast = useToast();
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [search, setSearch] = useState("");
  const [mappingTarget, setMappingTarget] = useState<Employee | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Employee | null>(null);
  const [lastResult, setLastResult] = useState<{
    employeeId: number;
    actionId: number;
    gitlabStatus: string;
    glesysStatus: string;
    agentQaStatus: string;
    teamworkStatus: string;
    logMonitorStatus: string;
    activeDirectoryStatus: string;
    overallStatus: string;
    gitlabDetail: string | null;
    glesysDetail: string | null;
    agentQaDetail: string | null;
    teamworkDetail: string | null;
    logMonitorDetail: string | null;
    activeDirectoryDetail: string | null;
  } | null>(null);
  const [revealTarget, setRevealTarget] = useState<{ employeeId: number; actionId: number } | null>(null);

  const load = useCallback(async (term?: string) => {
    const params = new URLSearchParams();
    if (term) params.set("search", term);
    const res = await fetch(`/api/admin/offboarding/employees?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.ok) setEmployees(data.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <Card style={{ marginBottom: "1rem" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          placeholder="Search by name, email, GitLab username, or mailbox..."
          style={{ ...inputStyle, maxWidth: 420 }}
        />
      </Card>

      {lastResult && (
        <Card style={{ marginBottom: "1rem", borderColor: "var(--primary)" }}>
          <h3 style={{ marginTop: 0, fontSize: "0.95rem" }}>Last run result</h3>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", fontSize: "0.85rem" }}>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><GitBranch {...systemIconProps(SYSTEM_COLORS.gitlab)} />GitLab</div>
              <StatusBadge status={lastResult.gitlabStatus} />
              {lastResult.gitlabDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.gitlabDetail}</p>}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><Mail {...systemIconProps(SYSTEM_COLORS.glesys)} />Glesys Email</div>
              <StatusBadge status={lastResult.glesysStatus} />
              {lastResult.glesysDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.glesysDetail}</p>}
              {lastResult.glesysStatus === "ManualActionRequired" && (
                <Button size="sm" variant="secondary" style={{ marginTop: "0.4rem" }} onClick={() => setRevealTarget({ employeeId: lastResult.employeeId, actionId: lastResult.actionId })}>
                  Reveal password for handoff
                </Button>
              )}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><Bot {...systemIconProps(SYSTEM_COLORS.agentqa)} />AgentQA</div>
              <StatusBadge status={lastResult.agentQaStatus} />
              {lastResult.agentQaDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.agentQaDetail}</p>}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><MessagesSquare {...systemIconProps(SYSTEM_COLORS.teamwork)} />Teamwork</div>
              <StatusBadge status={lastResult.teamworkStatus} />
              {lastResult.teamworkDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.teamworkDetail}</p>}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><Monitor {...systemIconProps(SYSTEM_COLORS.logmonitor)} />LogMonitor</div>
              <StatusBadge status={lastResult.logMonitorStatus} />
              {lastResult.logMonitorDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.logMonitorDetail}</p>}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}><Network {...systemIconProps(SYSTEM_COLORS.activeDirectory)} />Active Directory</div>
              <StatusBadge status={lastResult.activeDirectoryStatus} />
              {lastResult.activeDirectoryDetail && <p style={{ fontSize: "0.78rem", color: "var(--ink-muted)", maxWidth: 420 }}>{lastResult.activeDirectoryDetail}</p>}
            </div>
            <div>
              <div style={{ color: "var(--ink-muted)", marginBottom: "0.2rem" }}>Overall</div>
              <StatusBadge status={lastResult.overallStatus} />
            </div>
          </div>
        </Card>
      )}

      <div className="dash-panel">
        {employees === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : employees.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No employees found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Office Email</th>
                  <th style={{ padding: "0.4rem" }}>GitLab</th>
                  <th style={{ padding: "0.4rem" }}>Glesys</th>
                  <th style={{ padding: "0.4rem" }}><GitBranch {...systemIconProps(SYSTEM_COLORS.gitlab)} />GitLab Status</th>
                  <th style={{ padding: "0.4rem" }}><Mail {...systemIconProps(SYSTEM_COLORS.glesys)} />Glesys Status</th>
                  <th style={{ padding: "0.4rem" }}><Bot {...systemIconProps(SYSTEM_COLORS.agentqa)} />AgentQA Status</th>
                  <th style={{ padding: "0.4rem" }}><MessagesSquare {...systemIconProps(SYSTEM_COLORS.teamwork)} />Teamwork Status</th>
                  <th style={{ padding: "0.4rem" }}><Monitor {...systemIconProps(SYSTEM_COLORS.logmonitor)} />LogMonitor Status</th>
                  <th style={{ padding: "0.4rem" }}><Network {...systemIconProps(SYSTEM_COLORS.activeDirectory)} />AD Status</th>
                  <th style={{ padding: "0.4rem" }}>Overall</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{e.name}</td>
                    <td style={{ padding: "0.4rem", color: "var(--ink-muted)" }}>{e.email ?? "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{e.gitlabUsername ? `@${e.gitlabUsername}` : <span style={{ color: "var(--ink-muted)" }}>Not mapped</span>}</td>
                    <td style={{ padding: "0.4rem" }}>{e.glesysMailbox ?? <span style={{ color: "var(--ink-muted)" }}>Not mapped</span>}</td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.gitlabStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.glesysStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.agentQaStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.teamworkStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.logMonitorStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.activeDirectoryStatus} />
                    </td>
                    <td style={{ padding: "0.4rem" }}>
                      <StatusBadge status={e.overallStatus} />
                    </td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => setMappingTarget(e)}>
                          Map
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!e.gitlabUsername && !e.glesysMailbox && !e.email && !e.agentQaUserId && !e.teamworkEmail}
                          onClick={() => setConfirmTarget(e)}
                        >
                          {e.overallStatus === "Failed" || e.overallStatus === "PartiallyComplete" ? "Retry" : "Disable All"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mappingTarget && <MappingModal employee={mappingTarget} onClose={() => setMappingTarget(null)} onSaved={() => load(search)} />}
      {confirmTarget && (
        <ConfirmModal
          employee={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirmed={(result) => {
            setLastResult({ employeeId: confirmTarget.id, ...result });
            toast.show({ type: result.overallStatus === "Failed" ? "error" : "success", message: `Offboarding ${result.overallStatus}.` });
            load(search);
          }}
        />
      )}
      {revealTarget && <RevealGlesysPasswordModal employeeId={revealTarget.employeeId} actionId={revealTarget.actionId} onClose={() => setRevealTarget(null)} />}
    </div>
  );
}

export function OffboardingDashboardClient() {
  return (
    <ToastProvider>
      <DashboardInner />
    </ToastProvider>
  );
}

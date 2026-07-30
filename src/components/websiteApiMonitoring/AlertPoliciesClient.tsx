"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ToastProvider, useToast } from "@/components/ui/Toast";

interface ContactOption {
  Id: number;
  Name: string;
  ContactType: string;
}

interface EscalationStep {
  delayMinutes: number;
  contactIds: number[];
}

interface PolicyRow {
  Id: number;
  Name: string;
  IsDefault: boolean;
  NotifyOnDown: boolean;
  NotifyOnRecovery: boolean;
  NotifyOnDegraded: boolean;
  NotifyOnSslExpiring: boolean;
  QuietHoursEnabled: boolean;
  QuietHoursStart: string | null;
  QuietHoursEnd: string | null;
  QuietHoursTimezone: string;
  QuietHoursAllowCritical: boolean;
  EscalationEnabled: boolean;
  contactIds: number[];
  escalationSteps: EscalationStep[];
}

interface FormValues {
  name: string;
  isDefault: boolean;
  notifyOnDown: boolean;
  notifyOnRecovery: boolean;
  notifyOnDegraded: boolean;
  notifyOnSslExpiring: boolean;
  contactIds: number[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  quietHoursAllowCritical: boolean;
  escalationEnabled: boolean;
  escalationSteps: EscalationStep[];
}

const DEFAULT_FORM: FormValues = {
  name: "",
  isDefault: false,
  notifyOnDown: true,
  notifyOnRecovery: true,
  notifyOnDegraded: false,
  notifyOnSslExpiring: true,
  contactIds: [],
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  quietHoursTimezone: "UTC",
  quietHoursAllowCritical: true,
  escalationEnabled: false,
  escalationSteps: [],
};

const inputStyle = {
  padding: "0.5rem 0.7rem",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontSize: "0.85rem",
};

function toPayload(v: FormValues) {
  return {
    name: v.name,
    isDefault: v.isDefault,
    notifyOnDown: v.notifyOnDown,
    notifyOnRecovery: v.notifyOnRecovery,
    notifyOnDegraded: v.notifyOnDegraded,
    notifyOnSslExpiring: v.notifyOnSslExpiring,
    contactIds: v.contactIds,
    quietHoursEnabled: v.quietHoursEnabled,
    quietHoursStart: v.quietHoursEnabled ? v.quietHoursStart : null,
    quietHoursEnd: v.quietHoursEnabled ? v.quietHoursEnd : null,
    quietHoursTimezone: v.quietHoursTimezone,
    quietHoursAllowCritical: v.quietHoursAllowCritical,
    escalationEnabled: v.escalationEnabled,
    escalationSteps: v.escalationEnabled ? v.escalationSteps : [],
  };
}

function toFormValues(p: PolicyRow): FormValues {
  return {
    name: p.Name,
    isDefault: p.IsDefault,
    notifyOnDown: p.NotifyOnDown,
    notifyOnRecovery: p.NotifyOnRecovery,
    notifyOnDegraded: p.NotifyOnDegraded,
    notifyOnSslExpiring: p.NotifyOnSslExpiring,
    contactIds: p.contactIds,
    quietHoursEnabled: p.QuietHoursEnabled,
    quietHoursStart: p.QuietHoursStart ?? "22:00",
    quietHoursEnd: p.QuietHoursEnd ?? "07:00",
    quietHoursTimezone: p.QuietHoursTimezone || "UTC",
    quietHoursAllowCritical: p.QuietHoursAllowCritical,
    escalationEnabled: p.EscalationEnabled,
    escalationSteps: p.escalationSteps,
  };
}

function ContactCheckboxes({ contacts, selected, onChange }: { contacts: ContactOption[]; selected: number[]; onChange: (ids: number[]) => void }) {
  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  if (contacts.length === 0) return <p style={{ color: "var(--ink-muted)", fontSize: "0.8rem" }}>No alert contacts yet - add one under Alert Contacts first.</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {contacts.map((c) => (
        <label key={c.Id} style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", border: "1px solid var(--border)", borderRadius: 6, padding: "0.25rem 0.5rem" }}>
          <input type="checkbox" checked={selected.includes(c.Id)} onChange={() => toggle(c.Id)} />
          {c.Name} <span style={{ color: "var(--ink-muted)" }}>({c.ContactType === "InApp" ? "In-App" : c.ContactType})</span>
        </label>
      ))}
    </div>
  );
}

function EscalationStepsEditor({ contacts, steps, onChange }: { contacts: ContactOption[]; steps: EscalationStep[]; onChange: (steps: EscalationStep[]) => void }) {
  function update(i: number, patch: Partial<EscalationStep>) {
    onChange(steps.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  return (
    <div>
      {steps.map((s, i) => (
        <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}>
            <strong style={{ fontSize: "0.82rem" }}>Step {i + 1}</strong>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>fires after</span>
            <input type="number" min={1} value={s.delayMinutes} onChange={(e) => update(i, { delayMinutes: Number(e.target.value) })} style={{ ...inputStyle, width: 80 }} />
            <span style={{ fontSize: "0.8rem", color: "var(--ink-muted)" }}>minute(s) unacknowledged</span>
            <Button size="sm" variant="danger" onClick={() => onChange(steps.filter((_, idx) => idx !== i))}>
              Remove
            </Button>
          </div>
          <ContactCheckboxes contacts={contacts} selected={s.contactIds} onChange={(ids) => update(i, { contactIds: ids })} />
        </div>
      ))}
      <Button size="sm" variant="secondary" onClick={() => onChange([...steps, { delayMinutes: 15, contactIds: [] }])}>
        Add Escalation Step
      </Button>
    </div>
  );
}

function PolicyForm({ initial, contacts, onSaved, onCancel }: { initial: { id: number | "new"; values: FormValues }; contacts: ContactOption[]; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<FormValues>(initial.values);
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormValues>(key: K, val: FormValues[K]) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  async function save() {
    if (!values.name.trim()) {
      toast.show({ type: "error", message: "Policy name is required." });
      return;
    }
    if (values.quietHoursEnabled && (!values.quietHoursStart || !values.quietHoursEnd)) {
      toast.show({ type: "error", message: "Set both a quiet-hours start and end time." });
      return;
    }
    setSubmitting(true);
    try {
      const isNew = initial.id === "new";
      const res = await fetch(isNew ? "/api/admin/monitoring/alert-policies" : `/api/admin/monitoring/alert-policies/${initial.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(values)),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to save alert policy.");
      toast.show({ type: "success", message: "Alert policy saved." });
      onSaved();
    } catch (err) {
      toast.show({ type: "error", message: err instanceof Error ? err.message : "Failed to save alert policy." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card style={{ marginBottom: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>Policy Name</label>
          <input value={values.name} onChange={(e) => set("name", e.target.value)} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", marginTop: "1.3rem" }}>
          <input type="checkbox" checked={values.isDefault} onChange={(e) => set("isDefault", e.target.checked)} />
          Default policy
        </label>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Notify On</label>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={values.notifyOnDown} onChange={(e) => set("notifyOnDown", e.target.checked)} /> Down
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={values.notifyOnRecovery} onChange={(e) => set("notifyOnRecovery", e.target.checked)} /> Recovered
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={values.notifyOnDegraded} onChange={(e) => set("notifyOnDegraded", e.target.checked)} /> Degraded
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
            <input type="checkbox" checked={values.notifyOnSslExpiring} onChange={(e) => set("notifyOnSslExpiring", e.target.checked)} /> SSL Expiring
          </label>
        </div>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.3rem" }}>Alert Contacts</label>
        <ContactCheckboxes contacts={contacts} selected={values.contactIds} onChange={(ids) => set("contactIds", ids)} />
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem", marginBottom: "0.75rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", marginBottom: values.quietHoursEnabled ? "0.5rem" : 0 }}>
          <input type="checkbox" checked={values.quietHoursEnabled} onChange={(e) => set("quietHoursEnabled", e.target.checked)} />
          Quiet Hours
        </label>
        {values.quietHoursEnabled && (
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)" }}>Start</label>
              <input type="time" value={values.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)" }}>End</label>
              <input type="time" value={values.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-muted)" }}>Timezone (IANA)</label>
              <input value={values.quietHoursTimezone} onChange={(e) => set("quietHoursTimezone", e.target.value)} style={inputStyle} placeholder="Asia/Kathmandu" />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.82rem", marginTop: "1.1rem" }}>
              <input type="checkbox" checked={values.quietHoursAllowCritical} onChange={(e) => set("quietHoursAllowCritical", e.target.checked)} />
              Still notify for Down events
            </label>
          </div>
        )}
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem", marginBottom: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", marginBottom: values.escalationEnabled ? "0.5rem" : 0 }}>
          <input type="checkbox" checked={values.escalationEnabled} onChange={(e) => set("escalationEnabled", e.target.checked)} />
          Escalation
        </label>
        {values.escalationEnabled && <EscalationStepsEditor contacts={contacts} steps={values.escalationSteps} onChange={(steps) => set("escalationSteps", steps)} />}
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <Button onClick={save} disabled={submitting}>
          {submitting ? "Saving..." : "Save Policy"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function AlertPoliciesInner() {
  const toast = useToast();
  const [policies, setPolicies] = useState<PolicyRow[] | null>(null);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [editing, setEditing] = useState<{ id: number | "new"; values: FormValues } | null>(null);

  const load = useCallback(async () => {
    const [policiesRes, contactsRes] = await Promise.all([fetch("/api/admin/monitoring/alert-policies"), fetch("/api/admin/monitoring/alert-contacts")]);
    const policiesData = await policiesRes.json();
    const contactsData = await contactsRes.json();
    if (policiesRes.ok && policiesData.ok) setPolicies(policiesData.data);
    if (contactsRes.ok && contactsData.ok) setContacts(contactsData.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(row: PolicyRow) {
    const res = await fetch(`/api/admin/monitoring/alert-policies/${row.Id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      toast.show({ type: "error", message: data.error ?? "Failed to delete policy." });
      return;
    }
    toast.show({ type: "success", message: `${row.Name} deleted.` });
    await load();
  }

  return (
    <div>
      {editing ? (
        <PolicyForm
          initial={editing}
          contacts={contacts}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <div style={{ marginBottom: "1rem" }}>
          <Button onClick={() => setEditing({ id: "new", values: DEFAULT_FORM })}>New Alert Policy</Button>
        </div>
      )}

      <div className="dash-panel">
        {policies === null ? (
          <p style={{ color: "var(--ink-muted)" }}>Loading...</p>
        ) : policies.length === 0 ? (
          <p style={{ color: "var(--ink-muted)" }}>No alert policies yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--ink-muted)" }}>
                  <th style={{ padding: "0.4rem" }}>Name</th>
                  <th style={{ padding: "0.4rem" }}>Default</th>
                  <th style={{ padding: "0.4rem" }}>Contacts</th>
                  <th style={{ padding: "0.4rem" }}>Quiet Hours</th>
                  <th style={{ padding: "0.4rem" }}>Escalation</th>
                  <th style={{ padding: "0.4rem" }}></th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.Id} style={{ borderBottom: "1px solid var(--grid)" }}>
                    <td style={{ padding: "0.4rem" }}>{p.Name}</td>
                    <td style={{ padding: "0.4rem" }}>{p.IsDefault ? "Yes" : "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{p.contactIds.length}</td>
                    <td style={{ padding: "0.4rem" }}>{p.QuietHoursEnabled ? `${p.QuietHoursStart}-${p.QuietHoursEnd} ${p.QuietHoursTimezone}` : "-"}</td>
                    <td style={{ padding: "0.4rem" }}>{p.EscalationEnabled ? `${p.escalationSteps.length} step(s)` : "-"}</td>
                    <td style={{ padding: "0.4rem", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: "0.3rem" }}>
                        <Button size="sm" variant="secondary" onClick={() => setEditing({ id: p.Id, values: toFormValues(p) })}>
                          Edit
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => remove(p)} disabled={p.IsDefault}>
                          Delete
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
    </div>
  );
}

export function AlertPoliciesClient() {
  return (
    <ToastProvider>
      <AlertPoliciesInner />
    </ToastProvider>
  );
}

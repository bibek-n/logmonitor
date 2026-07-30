"use client";

import { LookupTableCRUD } from "@/components/settings/LookupTableCRUD";
import { ToastProvider } from "@/components/ui/Toast";

interface ExcludedDomain {
  id: number;
  domain: string;
  reason: string;
  notes: string | null;
}

const REASON_OPTIONS = [
  { label: "Personal", value: "personal" },
  { label: "Medical", value: "medical" },
  { label: "Banking", value: "banking" },
  { label: "Union", value: "union" },
  { label: "Legal", value: "legal" },
  { label: "Other", value: "other" },
];

export function ExcludedDomainsClient({ domains }: { domains: ExcludedDomain[] }) {
  return (
    <ToastProvider>
      <div className="flex flex-col gap-3">
        <p style={{ fontSize: "0.82rem", color: "var(--ink-muted)", margin: 0 }}>
          Domains listed here (and any subdomain) are never captured, regardless of device or employee - the agent filters
          them out before anything leaves the device. Use this for approved sensitive categories such as medical, banking,
          union, or legal sites.
        </p>
        <LookupTableCRUD
          title="Excluded Domains"
          apiBase="/api/admin/browser-activity/excluded-domains"
          rows={domains.map((d) => ({ Id: d.id, Domain: d.domain, Reason: d.reason, Notes: d.notes ?? "" }))}
          fields={[
            { key: "domain", label: "Domain", type: "text", required: true },
            { key: "reason", label: "Reason", type: "select", options: REASON_OPTIONS, required: true },
            { key: "notes", label: "Notes", type: "textarea" },
          ]}
          columns={[
            { key: "Domain", label: "Domain" },
            { key: "Reason", label: "Reason", render: (row) => <span style={{ textTransform: "capitalize" }}>{String(row.Reason)}</span> },
            { key: "Notes", label: "Notes" },
          ]}
        />
      </div>
    </ToastProvider>
  );
}

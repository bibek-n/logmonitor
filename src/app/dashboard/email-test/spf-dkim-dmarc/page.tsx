import ToolForm from "@/components/ToolForm";

export default function SpfDkimDmarcPage() {
  return (
    <div>
      <h1>SPF, DKIM &amp; DMARC Checker</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks a domain&apos;s SPF and DMARC TXT records, and DKIM if you know the selector (DKIM selectors aren&apos;t
        discoverable via DNS — leave blank to try a handful of common ones like &quot;default&quot; and
        &quot;google&quot;).
      </p>
      <ToolForm
        endpoint="/api/email-test/spf-dkim-dmarc"
        fields={[
          { name: "domain", label: "Domain", placeholder: "e.g. websearchpro.net", required: true },
          { name: "dkimSelector", label: "DKIM Selector (optional)", placeholder: "e.g. google, default, s1" },
        ]}
      />
    </div>
  );
}

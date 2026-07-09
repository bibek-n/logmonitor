import ToolForm from "@/components/ToolForm";

export default function UriblLookupPage() {
  return (
    <div>
      <h1>URIBL Spam Database Lookup</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Checks whether a domain is listed on major URI-based blacklists (SURBL, URIBL, Spamhaus DBL) — these track
        domains found in spam content/links, independent of which server actually sent the mail.
      </p>
      <ToolForm
        endpoint="/api/email-test/uribl"
        fields={[{ name: "domain", label: "Domain", placeholder: "e.g. websearchpro.net", required: true }]}
      />
    </div>
  );
}

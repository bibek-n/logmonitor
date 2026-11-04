import NetworkToolForm from "@/components/NetworkToolForm";

export default function RedirectCheckerPage() {
  return (
    <div>
      <h1>Redirect Checker</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Follows a URL&apos;s full redirect chain hop by hop — every HTTP 3xx along the way, not just the final destination — useful for
        tracking down redirect loops, unexpected hijacks, or a migration&apos;s leftover hops.
      </p>
      <NetworkToolForm endpoint="/api/tools/redirect-checker" targetLabel="URL" targetPlaceholder="e.g. https://example.com or example.com" />
    </div>
  );
}

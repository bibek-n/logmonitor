import JsonFormatterForm from "@/components/utilities/JsonFormatterForm";

export default function JsonFormatterPage() {
  return (
    <div>
      <h1>JSON Formatter</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Format (pretty-print) or minify JSON, with validation errors for malformed input.
      </p>
      <JsonFormatterForm />
    </div>
  );
}

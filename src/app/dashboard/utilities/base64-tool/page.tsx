import Base64ToolForm from "@/components/utilities/Base64ToolForm";

export default function Base64ToolPage() {
  return (
    <div>
      <h1>Base64 Tool</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Encode text to Base64 or decode a Base64 string back to text, with full UTF-8 support.
      </p>
      <Base64ToolForm />
    </div>
  );
}

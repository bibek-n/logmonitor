import HashGeneratorForm from "@/components/utilities/HashGeneratorForm";

export default function HashGeneratorPage() {
  return (
    <div>
      <h1>Hash Generator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Compute MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes of any text, entirely in your browser.
      </p>
      <HashGeneratorForm />
    </div>
  );
}

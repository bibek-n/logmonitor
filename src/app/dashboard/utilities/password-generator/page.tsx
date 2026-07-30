import PasswordGeneratorForm from "@/components/utilities/PasswordGeneratorForm";

export default function PasswordGeneratorPage() {
  return (
    <div>
      <h1>Password Generator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Generate a cryptographically random password with configurable length and character sets.
      </p>
      <PasswordGeneratorForm />
    </div>
  );
}

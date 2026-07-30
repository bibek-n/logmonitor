import YamlValidatorForm from "@/components/utilities/YamlValidatorForm";

export default function YamlValidatorPage() {
  return (
    <div>
      <h1>YAML Validator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Validate YAML syntax and preview it converted to JSON, with line/column error locations.
      </p>
      <YamlValidatorForm />
    </div>
  );
}

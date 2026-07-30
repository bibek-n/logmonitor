import XmlValidatorForm from "@/components/utilities/XmlValidatorForm";

export default function XmlValidatorPage() {
  return (
    <div>
      <h1>XML Validator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Validate XML well-formedness and preview it pretty-printed.
      </p>
      <XmlValidatorForm />
    </div>
  );
}

import RegexTesterForm from "@/components/utilities/RegexTesterForm";

export default function RegexTesterPage() {
  return (
    <div>
      <h1>Regex Tester</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Test a regular expression against a string of text, with live match highlighting and captured groups.
      </p>
      <RegexTesterForm />
    </div>
  );
}

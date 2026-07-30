import CidrCalculatorForm from "@/components/utilities/CidrCalculatorForm";

export default function CidrCalculatorPage() {
  return (
    <div>
      <h1>CIDR Calculator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Enter an address in CIDR notation to see its network address, broadcast address, usable host range, and more.
      </p>
      <CidrCalculatorForm />
    </div>
  );
}

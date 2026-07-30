import SubnetCalculatorForm from "@/components/utilities/SubnetCalculatorForm";

export default function SubnetCalculatorPage() {
  return (
    <div>
      <h1>Subnet Calculator</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Look up a network&apos;s subnet info, or split a network into a given number of smaller equal-sized subnets.
      </p>
      <SubnetCalculatorForm />
    </div>
  );
}

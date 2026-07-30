import { Card } from "@/components/ui/Card";

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <Card>
      <p style={{ color: "var(--ink-muted)" }}>{feature} is coming in a follow-up update to the IT Asset Logsheet module.</p>
    </Card>
  );
}

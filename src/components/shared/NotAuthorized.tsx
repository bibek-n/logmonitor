import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function NotAuthorized({ moduleName }: { moduleName: string }) {
  return (
    <Card className="flex flex-col items-center text-center" style={{ padding: "3rem 1.5rem", gap: "0.75rem" }}>
      <ShieldOff size={28} style={{ color: "var(--ink-muted)" }} />
      <h2 style={{ margin: 0, fontSize: "1.05rem" }}>You don&apos;t have access to {moduleName}</h2>
      <p style={{ margin: 0, color: "var(--ink-muted)", fontSize: "0.85rem", maxWidth: 380 }}>
        Ask an administrator to grant you the appropriate {moduleName} permission in Settings.
      </p>
    </Card>
  );
}

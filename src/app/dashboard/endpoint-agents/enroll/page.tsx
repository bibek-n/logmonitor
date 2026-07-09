import { getAdminSession } from "@/lib/requireAdmin";
import { getDb } from "@/lib/db";
import { EnrollClient } from "@/components/endpointAgents/EnrollClient";

export const dynamic = "force-dynamic";

interface TokenRow {
  Id: number;
  Token: string;
  CreatedAt: string;
  ExpiresAt: string;
  UsedAt: string | null;
  UsedByDeviceId: string | null;
}

export default async function EnrollPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Enroll Device</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can generate enrollment tokens.</p>
      </div>
    );
  }

  const db = await getDb();
  const result = await db.query<TokenRow>("SELECT TOP 50 Id, Token, CreatedAt, ExpiresAt, UsedAt, UsedByDeviceId FROM EnrollmentTokens ORDER BY CreatedAt DESC");

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Enroll Device</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Generate a one-time enrollment token, then run the matching install command on the target device.
      </p>

      <div
        style={{
          background: "color-mix(in srgb, var(--warning) 12%, transparent)",
          border: "1px solid color-mix(in srgb, var(--warning) 40%, transparent)",
          borderRadius: 12,
          padding: "1rem",
          marginBottom: "1.5rem",
          fontSize: "0.82rem",
          color: "var(--ink)",
        }}
      >
        <strong>Compliance notice:</strong> this agent must only be installed on company-owned devices, and staff
        must be informed via written policy before monitoring begins. The agent shows a local consent notice on
        first run and enrollment cannot complete without it being acknowledged. Screenshot capture is disabled by
        default per device and must be explicitly enabled from that device&apos;s settings page.
      </div>

      <EnrollClient existingTokens={result.recordset} />
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { isMailSession, requireMailPolicyPermission } from "@/lib/requireMailPolicyPermission";

// Stage 1 has no live provider connection and therefore no real quarantine store to release
// from - every incident today is a Test Policy simulation, not a real held message. This
// returns a clear, honest no-op rather than silently pretending to release something that
// was never actually held anywhere.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const mail = await requireMailPolicyPermission("mail_release_quarantine");
  if (!isMailSession(mail)) return mail;

  const { id } = await params;
  const db = await getDb();
  const result = await db.request().input("id", sql.Int, Number(id)).query<{ Source: string }>("SELECT Source FROM MailSecurityIncidents WHERE Id = @id");
  const incident = result.recordset[0];
  if (!incident) return NextResponse.json({ ok: false, error: "Incident not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    note:
      incident.Source === "Simulation"
        ? "Nothing to release - this incident came from the policy Test simulator, not a live provider. No mailbox was ever touched."
        : "Nothing to release - no live provider connection is configured yet (Stage 2).",
  });
}

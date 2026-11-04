import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

// Posts directly using whatever is currently SAVED in WebhookSettings (not whatever is
// unsaved in the form), same convention as the SMTP test button - "Save" then "Send test".
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{ Url: string | null; Platform: string; Enabled: boolean }>`
    SELECT Url, Platform, Enabled FROM WebhookSettings WHERE Id = 1
  `;
  const config = result.recordset[0];
  if (!config?.Url) {
    return NextResponse.json({ ok: false, error: "Save a webhook URL first." }, { status: 400 });
  }

  let success = true;
  let message = "Test message sent successfully.";
  try {
    const res = await fetch(config.Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "*LogMonitor test message*\nIf you can see this, webhook alerts are configured correctly." }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Endpoint returned ${res.status}: ${text.slice(0, 300)}`);
    }
  } catch (err) {
    success = false;
    message = err instanceof Error ? err.message : "Test message failed.";
  }

  await logAdminAction({ admin, section: "notifications", action: "send_test_webhook", details: `success=${success}`, req });

  return NextResponse.json({ ok: success, message });
}

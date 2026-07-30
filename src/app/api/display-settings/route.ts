import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getDb } from "@/lib/db";
import { DEFAULT_DISPLAY_SETTINGS, DisplaySettings } from "@/lib/dateFormat";

// Deliberately NOT admin-gated (unlike /api/admin/settings/system, which exposes the same
// CompanySettings row plus maintenance-mode controls) - knowing which timezone/date/time
// format to render with isn't sensitive, and any signed-in dashboard user (whatever their
// mon_*/sc_*/etc. permissions are) needs this to render timestamps consistently with "the
// application host" rather than their own browser's local timezone.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  try {
    const db = await getDb();
    const result = await db.query<{
      DefaultTimezone: string | null;
      DateFormat: string | null;
      TimeFormat: string | null;
      DefaultLanguage: string | null;
    }>`SELECT DefaultTimezone, DateFormat, TimeFormat, DefaultLanguage FROM CompanySettings WHERE Id = 1`;
    const row = result.recordset[0];
    const data: DisplaySettings = {
      timezone: row?.DefaultTimezone || DEFAULT_DISPLAY_SETTINGS.timezone,
      dateFormat: row?.DateFormat || DEFAULT_DISPLAY_SETTINGS.dateFormat,
      timeFormat: row?.TimeFormat || DEFAULT_DISPLAY_SETTINGS.timeFormat,
      locale: row?.DefaultLanguage || DEFAULT_DISPLAY_SETTINGS.locale,
    };
    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: true, data: DEFAULT_DISPLAY_SETTINGS });
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PublicBrandingRow {
  CompanyName: string | null;
  LogoPath: string | null;
  LoginBrandingEnabled: boolean;
  LoginTagline: string | null;
}

// Unauthenticated by design - this is exactly the information a login screen needs to show
// before anyone has signed in. Deliberately a narrow SELECT, never the full CompanySettings row
// (which also holds address/contact PII and retention/backup settings), so adding a column
// there later can't accidentally leak through here.
export async function GET() {
  const db = await getDb();
  const result = await db.query<PublicBrandingRow>`
    SELECT CompanyName, LogoPath, LoginBrandingEnabled, LoginTagline FROM CompanySettings WHERE Id = 1
  `;
  const row = result.recordset[0] ?? null;
  return NextResponse.json({
    ok: true,
    data: row
      ? {
          companyName: row.CompanyName,
          logoPath: row.LogoPath,
          loginBrandingEnabled: row.LoginBrandingEnabled,
          loginTagline: row.LoginTagline,
        }
      : null,
  });
}

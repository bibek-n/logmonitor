import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireMobileAdmin, isMobileSession } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const admin = await requireMobileAdmin(req);
  if (!isMobileSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<{ Id: number; Name: string }>("SELECT Id, Name FROM Staff ORDER BY Name");
  return NextResponse.json({ ok: true, staff: result.recordset });
}

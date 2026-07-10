import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { logAdminAction } from "@/lib/adminAudit";

export interface CompanyProfileData {
  CompanyName: string | null;
  LogoPath: string | null;
  WebsiteUrl: string | null;
  Industry: string | null;
  CompanySize: string | null;
  AddressLine1: string | null;
  AddressLine2: string | null;
  City: string | null;
  State: string | null;
  PostalCode: string | null;
  Country: string | null;
  ContactEmail: string | null;
  ContactPhone: string | null;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const db = await getDb();
  const result = await db.query<CompanyProfileData>`
    SELECT CompanyName, LogoPath, WebsiteUrl, Industry, CompanySize, AddressLine1, AddressLine2,
      City, State, PostalCode, Country, ContactEmail, ContactPhone
    FROM CompanySettings WHERE Id = 1
  `;
  return NextResponse.json({ ok: true, data: result.recordset[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const db = await getDb();
  await db
    .request()
    .input("companyName", sql.NVarChar, str(body.companyName))
    .input("websiteUrl", sql.NVarChar, str(body.websiteUrl))
    .input("industry", sql.NVarChar, str(body.industry))
    .input("companySize", sql.NVarChar, str(body.companySize))
    .input("addressLine1", sql.NVarChar, str(body.addressLine1))
    .input("addressLine2", sql.NVarChar, str(body.addressLine2))
    .input("city", sql.NVarChar, str(body.city))
    .input("state", sql.NVarChar, str(body.state))
    .input("postalCode", sql.NVarChar, str(body.postalCode))
    .input("country", sql.NVarChar, str(body.country))
    .input("contactEmail", sql.NVarChar, str(body.contactEmail))
    .input("contactPhone", sql.NVarChar, str(body.contactPhone))
    .input("updatedByUserId", sql.Int, admin.userId)
    .query(`
      UPDATE CompanySettings SET
        CompanyName = @companyName, WebsiteUrl = @websiteUrl, Industry = @industry, CompanySize = @companySize,
        AddressLine1 = @addressLine1, AddressLine2 = @addressLine2, City = @city, State = @state,
        PostalCode = @postalCode, Country = @country, ContactEmail = @contactEmail, ContactPhone = @contactPhone,
        UpdatedAt = SYSUTCDATETIME(), UpdatedByUserId = @updatedByUserId
      WHERE Id = 1
    `);

  await logAdminAction({ admin, section: "company_profile", action: "update", req });

  return NextResponse.json({ ok: true });
}

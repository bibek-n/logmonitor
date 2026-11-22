// Kept out of websiteContent.ts deliberately: that file also exports plain constants
// (PUBLIC_NAV, FOOTER_LINKS, etc.) imported by client components like PublicNav.tsx. A server-
// only DB-reading function living in the same module pulled mssql/tedious (and the Node
// built-ins it needs - tls/net/dns) into the client bundle and broke the production build, even
// though the function itself was dynamically imported. This file is only ever imported from
// server components (contact/support pages, PublicFooter), so it never reaches the client
// bundle graph.
import { getDb } from "@/lib/db";

export interface ContactInfo {
  address: string | null;
  phone: string | null;
  email: string | null;
  hours: string | null;
  // Not sourced from CompanySettings - a Google Maps embed URL is tied to one specific
  // physical address (originally baked in here as Tulips Technologies' own Place ID), and
  // there's no per-deployment field for a company's own embed yet. Always null until one
  // exists, rather than leaking a different company's own office onto someone else's page.
  mapEmbedUrl: string | null;
}

// Was a hardcoded constant (Tulips Technologies' own address/phone/email, plus a Google Maps
// embed of their specific office) - this is this app's own public marketing site, so a company
// running their own deployment needs this to describe THEM, not whichever company the code was
// originally written for. Reads the same CompanySettings fields Settings > Company Profile
// already captures; any address/phone/email left unset on a fresh deployment is simply omitted
// by the pages that render this, never defaulted back to Tulips' own values. Mirrors the
// try/catch pattern PublicFooter.tsx already uses for FooterText.
export async function getContactInfo(): Promise<ContactInfo> {
  try {
    const db = await getDb();
    const result = await db.query<{
      AddressLine1: string | null;
      AddressLine2: string | null;
      City: string | null;
      State: string | null;
      PostalCode: string | null;
      Country: string | null;
      ContactEmail: string | null;
      ContactPhone: string | null;
    }>`
      SELECT AddressLine1, AddressLine2, City, State, PostalCode, Country, ContactEmail, ContactPhone
      FROM CompanySettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    const addressParts = [row?.AddressLine1, row?.AddressLine2, row?.City, row?.State, row?.PostalCode, row?.Country].filter(
      (p): p is string => !!p
    );
    return {
      address: addressParts.length > 0 ? addressParts.join(", ") : null,
      phone: row?.ContactPhone ?? null,
      email: row?.ContactEmail ?? null,
      hours: null,
      mapEmbedUrl: null,
    };
  } catch {
    return { address: null, phone: null, email: null, hours: null, mapEmbedUrl: null };
  }
}

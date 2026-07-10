import { getDb } from "@/lib/db";

async function getBrandColors(): Promise<{ primary: string | null; secondary: string | null }> {
  try {
    const db = await getDb();
    const result = await db.query<{ PrimaryColor: string | null; SecondaryColor: string | null }>`
      SELECT PrimaryColor, SecondaryColor FROM CompanySettings WHERE Id = 1
    `;
    const row = result.recordset[0];
    return { primary: row?.PrimaryColor ?? null, secondary: row?.SecondaryColor ?? null };
  } catch {
    return { primary: null, secondary: null };
  }
}

// Injects --mkt-primary/--mkt-primary-dark overrides for src/lib/marketingTheme.ts's MKT
// constant when an admin has set a custom brand color under Company Settings > Branding.
// Renders nothing when unset, so the hardcoded fallback in marketingTheme.ts applies.
export async function BrandColorStyle() {
  const { primary, secondary } = await getBrandColors();
  if (!primary && !secondary) return null;

  return (
    <style>{`:root{${primary ? `--mkt-primary:${primary};` : ""}${secondary ? `--mkt-primary-dark:${secondary};` : ""}}`}</style>
  );
}

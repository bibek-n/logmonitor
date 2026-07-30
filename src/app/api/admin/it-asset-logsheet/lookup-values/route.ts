import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { lookupValueSchema } from "@/lib/itAssetLogsheet/schema";
import { createLookupValue, listLookupValues } from "@/lib/itAssetLogsheet/repository";

export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const category = req.nextUrl.searchParams.get("category") ?? undefined;
  const values = await listLookupValues(category);
  return NextResponse.json({ ok: true, data: values });
}

export async function POST(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_settings_manage");
  if (!isItAssetSession(ita)) return ita;

  const body = await req.json().catch(() => null);
  const parsed = lookupValueSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid lookup value" }, { status: 400 });
  }

  const id = await createLookupValue(parsed.data.category, parsed.data.value, parsed.data.sortOrder, ita.userId);
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "lookup_value_create", details: `${parsed.data.category}: ${parsed.data.value}`, req });

  return NextResponse.json({ ok: true, data: { id } });
}

import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/adminAudit";
import { isItAssetSession, requireItAssetPermission } from "@/lib/requireItAssetPermission";
import { createAssetSchema } from "@/lib/itAssetLogsheet/schema";
import { createAsset, findAssetDuplicates, listAssets } from "@/lib/itAssetLogsheet/repository";

export async function GET(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_view");
  if (!isItAssetSession(ita)) return ita;

  const params = req.nextUrl.searchParams;
  const result = await listAssets({
    search: params.get("search") ?? undefined,
    assetType: params.get("assetType") ?? undefined,
    status: params.get("status") ?? undefined,
    criticality: params.get("criticality") ?? undefined,
    department: params.get("department") ?? undefined,
    location: params.get("location") ?? undefined,
    assignedUser: params.get("assignedUser") ?? undefined,
    technician: params.get("technician") ?? undefined,
    page: params.get("page") ? Number(params.get("page")) : undefined,
    pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
    sortBy: params.get("sortBy") ?? undefined,
    sortDir: params.get("sortDir") === "DESC" ? "DESC" : "ASC",
  });

  return NextResponse.json({ ok: true, data: result.assets, total: result.total });
}

export async function POST(req: NextRequest) {
  const ita = await requireItAssetPermission("ita_asset_create");
  if (!isItAssetSession(ita)) return ita;

  const body = await req.json().catch(() => null);
  const parsed = createAssetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid asset" }, { status: 400 });
  }

  const duplicates = await findAssetDuplicates({
    assetTag: parsed.data.assetTag,
    serialNumber: parsed.data.serialNumber ?? undefined,
    hostname: parsed.data.hostname ?? undefined,
    ipAddress: parsed.data.ipAddress ?? undefined,
  });
  if (duplicates.length > 0) {
    return NextResponse.json(
      { ok: false, error: "An asset with this Asset Tag, Serial Number, Hostname, or IP Address already exists.", duplicates: duplicates.map((d) => ({ id: d.id, assetTag: d.assetTag })) },
      { status: 409 }
    );
  }

  const id = await createAsset(parsed.data, { userId: ita.userId, username: ita.username });
  await logAdminAction({ admin: ita, section: "it-asset-logsheet", action: "asset_create", details: parsed.data.assetTag, req });

  return NextResponse.json({ ok: true, data: { id } });
}

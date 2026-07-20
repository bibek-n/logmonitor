import { NextResponse } from "next/server";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";
import { getPasskeysForUser } from "@/lib/webauthn";

export async function GET() {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const passkeys = await getPasskeysForUser(admin.userId);
  return NextResponse.json({
    ok: true,
    passkeys: passkeys.map((p) => ({
      id: p.id,
      deviceLabel: p.deviceLabel,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    })),
  });
}

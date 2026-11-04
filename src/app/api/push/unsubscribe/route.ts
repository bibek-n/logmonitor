import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/authOptions";
import { removeSubscriptionByEndpoint } from "@/lib/pushNotifications";

const bodySchema = z.object({ endpoint: z.string().url() });

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  await removeSubscriptionByEndpoint(parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}

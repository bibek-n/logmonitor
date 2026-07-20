import { NextResponse } from "next/server";
import { getNetworkHardwareNews } from "@/lib/newsFeed";

// Always responds 200 (see other routes in this app for why — IIS replaces non-2xx bodies
// with a generic HTML page). Public, unauthenticated — this feeds the marketing site's news
// ticker, not the admin dashboard.
export async function GET() {
  try {
    const items = await getNetworkHardwareNews();
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to load news", items: [] });
  }
}

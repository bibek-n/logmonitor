import { NextResponse } from "next/server";
import { getNepaliTechNews } from "@/lib/nepaliTechNewsFeed";

// Always responds 200 (see other routes in this app for why — IIS replaces non-2xx bodies).
// Public, unauthenticated — feeds the marketing home page's Nepali Tech News widget.
export async function GET() {
  try {
    const items = await getNepaliTechNews(5);
    return NextResponse.json({ ok: true, items });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to load news", items: [] });
  }
}

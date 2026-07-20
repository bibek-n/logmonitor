import { NextResponse } from "next/server";
import { getKnowledgeHub } from "@/lib/knowledgeFeed";

// Always responds 200 (see other routes in this app for why — IIS replaces non-2xx bodies).
// Public, unauthenticated — feeds the marketing home page's Knowledge Hub widget.
export async function GET() {
  try {
    const groups = await getKnowledgeHub();
    return NextResponse.json({ ok: true, groups });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Failed to load knowledge hub",
      groups: { hardwareNetworking: [], softwareAi: [] },
    });
  }
}

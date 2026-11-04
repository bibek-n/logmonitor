import { NextRequest, NextResponse } from "next/server";
import { getDb, sql } from "@/lib/db";
import { requireAdmin, isAdminSession } from "@/lib/requireAdmin";

export interface SearchResult {
  type: "staff" | "website" | "kb-doc" | "incident";
  id: number;
  label: string;
  sublabel: string | null;
  href: string;
}

// Backs the command palette's live search (staff/websites/KB docs/incident reports by name) -
// deliberately a fixed, curated set of tables rather than a generic cross-table search, since
// these are what an admin most often needs to jump straight to by typing a name instead of
// navigating through the sidebar. This route is already admin-only (requireAdmin below), so
// it doesn't need the finer-grained kb_view/kb_manage permission checks the Knowledge Base
// page itself uses for non-admin staff accounts.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!isAdminSession(admin)) return admin;

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  const db = await getDb();
  const like = `%${q}%`;

  const [staffResult, websiteResult, kbResult, incidentResult] = await Promise.all([
    db.request().input("q", sql.NVarChar, like).query<{ Id: number; Name: string; Department: string | null }>(
      "SELECT TOP 6 Id, Name, Department FROM Staff WHERE Name LIKE @q ORDER BY Name"
    ),
    db.request().input("q", sql.NVarChar, like).query<{ Id: number; Name: string; Url: string }>(
      "SELECT TOP 6 Id, Name, Url FROM Websites WHERE Name LIKE @q OR Url LIKE @q ORDER BY Name"
    ),
    db.request().input("q", sql.NVarChar, like).query<{ Id: number; Title: string; Category: string | null }>(
      "SELECT TOP 6 Id, Title, Category FROM KnowledgeBaseDocuments WHERE Title LIKE @q ORDER BY Title"
    ),
    db.request().input("q", sql.NVarChar, like).query<{ Id: number; Title: string }>(
      "SELECT TOP 6 Id, Title FROM IncidentReports WHERE Title LIKE @q ORDER BY UploadedAt DESC"
    ),
  ]);

  const results: SearchResult[] = [
    ...staffResult.recordset.map((s) => ({ type: "staff" as const, id: s.Id, label: s.Name, sublabel: s.Department, href: `/dashboard/staff/${s.Id}` })),
    ...websiteResult.recordset.map((w) => ({ type: "website" as const, id: w.Id, label: w.Name, sublabel: w.Url, href: `/dashboard/audit/website-security/${w.Id}` })),
    ...kbResult.recordset.map((k) => ({ type: "kb-doc" as const, id: k.Id, label: k.Title, sublabel: k.Category, href: `/dashboard/knowledge-base` })),
    ...incidentResult.recordset.map((i) => ({ type: "incident" as const, id: i.Id, label: i.Title, sublabel: null, href: `/dashboard/incident-reports` })),
  ];

  return NextResponse.json({ ok: true, results });
}

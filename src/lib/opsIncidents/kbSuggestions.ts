import { getDb } from "../db";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "to", "of", "in", "on", "for", "and", "or", "with", "at", "by", "from", "has", "have", "had",
  "not", "this", "that", "it", "its", "be", "as", "down", "up", "error", "issue", "failed", "failure", "problem",
]);

function extractKeywords(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? [])].filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export interface KbSuggestion {
  id: number;
  title: string;
  category: string;
  matchedKeywords: string[];
}

interface KbDocRow {
  Id: number;
  Title: string;
  Description: string | null;
  Category: string;
  Tags: string | null;
}

// Scored in JS rather than a dynamic N-keyword SQL WHERE - KnowledgeBaseDocuments has no
// full-text index, and this app's whole KB is an internal IT doc library (dozens of rows, not
// millions), so fetching everything and scoring client-side keeps this simple and avoids
// building dynamic SQL from user-influenced keyword lists. Match = how many of the incident's
// own keywords (from its Title + AffectedSystem) appear anywhere in a document's Title/
// Description/Category/Tags; top 5 by match count, ties broken by most recently updated.
export async function suggestKbArticles(incidentTitle: string, affectedSystem: string | null): Promise<KbSuggestion[]> {
  const keywords = extractKeywords(`${incidentTitle} ${affectedSystem ?? ""}`);
  if (keywords.length === 0) return [];

  const db = await getDb();
  const docs = await db.query<KbDocRow>("SELECT Id, Title, Description, Category, Tags FROM KnowledgeBaseDocuments ORDER BY UpdatedAt DESC");

  const scored = docs.recordset
    .map((d) => {
      const haystack = `${d.Title} ${d.Description ?? ""} ${d.Category} ${d.Tags ?? ""}`.toLowerCase();
      const matched = keywords.filter((k) => haystack.includes(k));
      return { id: d.Id, title: d.Title, category: d.Category, matchedKeywords: matched };
    })
    .filter((d) => d.matchedKeywords.length > 0)
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length);

  return scored.slice(0, 5);
}

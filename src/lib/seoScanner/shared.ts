// Types shared between server-side scan logic and client components. Kept free of any
// server-only imports so client components can import this file directly without pulling
// server code into the browser bundle.

export type CheckId =
  | "robots_txt"
  | "sitemap_xml"
  | "meta_tags"
  | "canonical_url"
  | "broken_links"
  | "image_alt"
  | "open_graph"
  | "twitter_cards"
  | "structured_data";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface ScanFinding {
  check: CheckId;
  severity: Severity;
  title: string;
  detail?: string;
  evidence?: string;
}

export type CheckStatus = "ok" | "issues_found" | "error";

export interface CheckSummary {
  check: CheckId;
  label: string;
  status: CheckStatus;
  findingCount: number;
}

export interface SeoScanReport {
  targetUrl: string;
  score: number;
  grade: string;
  findings: ScanFinding[];
  checks: CheckSummary[];
  scannedAt: string;
}

// The 9 check categories this scan covers, in display order - used to build the "Included
// checks" UI regardless of whether a given scan actually ran/found anything for a check yet.
export const CHECK_LABELS: Record<CheckId, string> = {
  robots_txt: "robots.txt",
  sitemap_xml: "sitemap.xml",
  meta_tags: "Meta Tags",
  canonical_url: "Canonical URL",
  broken_links: "Broken Links",
  image_alt: "Image Alt",
  open_graph: "Open Graph",
  twitter_cards: "Twitter Cards",
  structured_data: "Structured Data",
};

export const CHECK_ORDER: CheckId[] = [
  "robots_txt",
  "sitemap_xml",
  "meta_tags",
  "canonical_url",
  "broken_links",
  "image_alt",
  "open_graph",
  "twitter_cards",
  "structured_data",
];

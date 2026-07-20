// Pure types only - safe to import from client components (see the equivalent split in
// src/lib/websitePerformance/shared.ts). Server-only code (DB access, VT calls, file storage)
// lives in sibling files (runScan.ts, virustotal.ts, fileStorage.ts) and must never be
// imported here or from a "use client" file.

export type ThreatScanKind = "File" | "Url" | "Hash" | "Ip" | "Domain";
export type ThreatScanStatus = "Pending" | "Running" | "Completed" | "Failed" | "NotFound";
export type ThreatScanVerdict = "Malicious" | "Suspicious" | "Clean";

export interface ThreatEngineResultRow {
  engineName: string;
  category: string;
  result: string | null;
}

export interface ThreatScanRow {
  Id: number;
  Kind: ThreatScanKind;
  Target: string;
  WebsiteId: number | null;
  VtResourceId?: string | null;
  Status: ThreatScanStatus;
  Verdict: ThreatScanVerdict | null;
  MaliciousCount: number | null;
  SuspiciousCount: number | null;
  HarmlessCount: number | null;
  UndetectedCount: number | null;
  TimeoutCount: number | null;
  EngineCount: number | null;
  ResultJson: string | null;
  ErrorMessage: string | null;
  OriginalFileName: string | null;
  ContentType: string | null;
  SizeBytes: number | null;
  TriggeredByUsername: string | null;
  StartedAt: string | null;
  CompletedAt: string | null;
  CreatedAt: string;
}

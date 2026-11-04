import DatabaseAnalyzerListClient from "@/components/databaseAnalyzer/DatabaseAnalyzerListClient";
import DatabaseAnalyzerAiSettingsPanel from "@/components/databaseAnalyzer/DatabaseAnalyzerAiSettingsPanel";

export const dynamic = "force-dynamic";

export default function DatabaseAnalyzerPage() {
  return (
    <div>
      <h1>Database Intelligence &amp; Security Analyzer</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: "-0.5rem" }}>
        Connects to a database you register (SQL Server, MySQL, or PostgreSQL), or an uploaded .sql schema dump, and
        runs a read-only structure, security, and sensitive-data scan — schema metadata only, never actual row
        data. Works fully in Non-AI mode with no configuration; AI/Hybrid mode below adds model-generated findings
        and a plain-language summary on top of the same rule engine.
      </p>
      <DatabaseAnalyzerAiSettingsPanel />
      <DatabaseAnalyzerListClient />
    </div>
  );
}

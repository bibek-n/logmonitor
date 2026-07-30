import { ListTree } from "lucide-react";
import { getAdminSession } from "@/lib/requireAdmin";
import { isAiModulesConfigured } from "@/lib/aiModules/shared";
import { AI_MODULES } from "@/lib/aiModules/modules";
import { AiModuleChat } from "@/components/aiModules/AiModuleChat";

export const dynamic = "force-dynamic";

const MODULE = AI_MODULES.aiLogAnalyzer;

export default async function AiLogAnalyzerPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>{MODULE.label}</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can use this AI module.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>{MODULE.label}</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>{MODULE.description}</p>

      {!isAiModulesConfigured() ? (
        <div className="dash-panel" style={{ borderColor: "var(--warning)", color: "var(--ink-muted)", fontSize: "0.85rem" }}>
          This AI module isn&apos;t set up on this server yet - an administrator needs to add <code>GITHUB_MODELS_TOKEN</code>{" "}
          to the server&apos;s environment configuration.
        </div>
      ) : (
        <AiModuleChat
          apiEndpoint="/api/admin/ai-modules/ai-log-analyzer/ask"
          exampleQuestions={MODULE.exampleQuestions}
          icon={<ListTree size={14} />}
          placeholder="Which device's logs do you want analyzed?"
        />
      )}
    </div>
  );
}

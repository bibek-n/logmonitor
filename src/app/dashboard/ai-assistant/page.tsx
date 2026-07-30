import { getAdminSession } from "@/lib/requireAdmin";
import { isAiAssistantConfigured } from "@/lib/aiAssistant/assistant";
import { AiAssistantChat } from "@/components/aiAssistant/AiAssistantChat";

export const dynamic = "force-dynamic";

export default async function AiAssistantPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>AI Assistant</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can use the AI Assistant.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>AI Assistant</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Ask questions about your infrastructure in plain language - answers are grounded in this
        dashboard&apos;s own data, not guessed.
      </p>

      {!isAiAssistantConfigured() ? (
        <div
          className="dash-panel"
          style={{ borderColor: "var(--warning)", color: "var(--ink-muted)", fontSize: "0.85rem" }}
        >
          AI Assistant isn&apos;t set up on this server yet - an administrator needs to add{" "}
          <code>GITHUB_MODELS_TOKEN</code> to the server&apos;s environment configuration.
        </div>
      ) : (
        <AiAssistantChat />
      )}
    </div>
  );
}

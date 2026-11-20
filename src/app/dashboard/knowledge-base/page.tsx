import { getKnowledgeBaseAccess } from "@/lib/requireKnowledgeBasePermission";
import { KnowledgeBaseClient } from "@/components/knowledgeBase/KnowledgeBaseClient";

export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  const { kb, can } = await getKnowledgeBaseAccess();
  if (!kb) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Knowledge Base</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to view this page.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Knowledge Base</h1>
      <KnowledgeBaseClient canManage={!!can.kb_manage} />
    </div>
  );
}

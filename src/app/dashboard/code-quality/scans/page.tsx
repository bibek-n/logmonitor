import { getCqAccess } from "@/lib/requireCodeQualityPermission";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ScansListClient } from "@/components/codeQuality/ScansListClient";

export const dynamic = "force-dynamic";

export default async function CodeQualityScansPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { cq, can } = await getCqAccess();
  if (!cq) return <NotAuthorized />;
  const { projectId } = await searchParams;
  return <ScansListClient can={can} initialProjectId={projectId} />;
}

import { getCqAccess } from "@/lib/requireCodeQualityPermission";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ProjectsListClient } from "@/components/codeQuality/ProjectsListClient";

export const dynamic = "force-dynamic";

export default async function CodeQualityProjectsPage() {
  const { cq, can } = await getCqAccess();
  if (!cq) return <NotAuthorized />;
  return <ProjectsListClient can={can} />;
}

import { getCqSession } from "@/lib/requireCodeQualityPermission";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { ProjectFormClient } from "@/components/codeQuality/ProjectFormClient";

export const dynamic = "force-dynamic";

export default async function NewCodeQualityProjectPage() {
  const cq = await getCqSession("cq_project_create");
  if (!cq) return <NotAuthorized />;
  return <ProjectFormClient />;
}

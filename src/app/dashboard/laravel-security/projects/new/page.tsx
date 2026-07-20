import { getLsSession } from "@/lib/requireLaravelSecurityPermission";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ProjectFormClient } from "@/components/laravelSecurity/ProjectFormClient";

export const dynamic = "force-dynamic";

export default async function NewLaravelSecurityProjectPage() {
  const ls = await getLsSession("ls_project_create");
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;
  return <ProjectFormClient />;
}

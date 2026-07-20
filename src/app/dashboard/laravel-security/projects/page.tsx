import { getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ProjectsListClient } from "@/components/laravelSecurity/ProjectsListClient";

export const dynamic = "force-dynamic";

export default async function LaravelSecurityProjectsPage() {
  const { ls, can } = await getLsAccess();
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;
  return <ProjectsListClient can={can} />;
}

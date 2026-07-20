import { getLsAccess } from "@/lib/requireLaravelSecurityPermission";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { ScansListClient } from "@/components/laravelSecurity/ScansListClient";

export const dynamic = "force-dynamic";

export default async function LaravelSecurityScansPage({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { ls, can } = await getLsAccess();
  if (!ls) return <NotAuthorized moduleName="Laravel Security" />;
  const { projectId } = await searchParams;
  return <ScansListClient can={can} initialProjectId={projectId} />;
}

import { getIntegrationSession } from "@/lib/requireIntegrationPermission";
import { NotAuthorized } from "@/components/shared/NotAuthorized";
import { GitConnectionsClient } from "@/components/integrations/GitConnectionsClient";

export const dynamic = "force-dynamic";

export default async function GitConnectionsPage() {
  const session = await getIntegrationSession("integrations_git_view");
  if (!session) return <NotAuthorized moduleName="Git Connections" />;

  const canManage = (await getIntegrationSession("integrations_git_manage")) !== null;

  return <GitConnectionsClient canManage={canManage} />;
}

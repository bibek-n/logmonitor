import { getCqSession } from "@/lib/requireCodeQualityPermission";
import { CodeQualityDashboardClient } from "@/components/codeQuality/CodeQualityDashboardClient";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";

export const dynamic = "force-dynamic";

export default async function CodeQualityDashboardPage() {
  const cq = await getCqSession("cq_view");
  if (!cq) return <NotAuthorized />;
  return <CodeQualityDashboardClient />;
}

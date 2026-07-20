import { getCqSession, getCqAccess } from "@/lib/requireCodeQualityPermission";
import { NotAuthorized } from "@/components/codeQuality/NotAuthorized";
import { SettingsClient } from "@/components/codeQuality/SettingsClient";

export const dynamic = "force-dynamic";

export default async function CodeQualitySettingsPage() {
  const cq = await getCqSession("cq_view");
  if (!cq) return <NotAuthorized />;
  const { can } = await getCqAccess();
  return <SettingsClient canManage={can.cq_settings_manage} />;
}

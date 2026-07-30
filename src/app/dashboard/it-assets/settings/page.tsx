import { getItAssetSession } from "@/lib/requireItAssetPermission";
import { SettingsClient } from "@/components/itAssetLogsheet/SettingsClient";

export const dynamic = "force-dynamic";

export default async function ItAssetSettingsPage() {
  const ita = await getItAssetSession("ita_settings_manage");
  if (!ita) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Settings</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to manage IT Asset Logsheet settings.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Settings</h1>
      <SettingsClient />
    </div>
  );
}

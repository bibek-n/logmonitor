import { getBrowserActivitySession } from "@/lib/requireBrowserActivityPermission";
import { getBrowserActivitySettings } from "@/lib/browserActivity/repository";
import { SettingsClient } from "@/components/browserActivity/SettingsClient";

export const dynamic = "force-dynamic";

export default async function BrowserActivitySettingsPage() {
  const ba = await getBrowserActivitySession("ba_settings_manage");
  if (!ba) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Settings</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to manage browser activity settings.</p>
      </div>
    );
  }

  const settings = await getBrowserActivitySettings();

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Settings</h1>
      <SettingsClient initial={settings} />
    </div>
  );
}

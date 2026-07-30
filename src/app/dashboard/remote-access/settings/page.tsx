import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { SettingsClient } from "@/components/remoteAccess/SettingsClient";

export const dynamic = "force-dynamic";

export default async function RemoteAccessSettingsPage() {
  const ra = await getRemoteAccessSession("ra_settings_manage");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Access Settings</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Remote Access Settings.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Access Settings</h1>
      <SettingsClient />
    </div>
  );
}

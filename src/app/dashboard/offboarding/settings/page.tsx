import { getOffboardingSession } from "@/lib/requireOffboardingPermission";
import { OffboardingSettingsClient } from "@/components/offboarding/OffboardingSettingsClient";

export const dynamic = "force-dynamic";

export default async function OffboardingSettingsPage() {
  const off = await getOffboardingSession("off_settings_manage");
  if (!off) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Offboarding Settings</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to Offboarding Settings.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Offboarding Settings</h1>
      <OffboardingSettingsClient />
    </div>
  );
}

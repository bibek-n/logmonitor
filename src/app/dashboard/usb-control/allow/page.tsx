import { getAdminSession } from "@/lib/requireAdmin";
import { UsbPolicyListClient } from "@/components/usbControl/UsbPolicyListClient";

export const dynamic = "force-dynamic";

export default async function UsbAllowPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Allow</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage the USB allow list.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Allow</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Declare which USB devices should always be allowed, by vendor ID, serial number, or device name.
      </p>
      <UsbPolicyListClient action="Allow" />
    </div>
  );
}

import { getAdminSession } from "@/lib/requireAdmin";
import { UsbPolicyListClient } from "@/components/usbControl/UsbPolicyListClient";

export const dynamic = "force-dynamic";

export default async function UsbBlockPage() {
  const admin = await getAdminSession();
  if (!admin) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Block</h1>
        <p style={{ color: "var(--danger)" }}>Only admins can manage the USB block list.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Block</h1>
      <p style={{ color: "var(--ink-muted)", fontSize: "0.85rem", marginTop: 0, marginBottom: "1rem" }}>
        Declare which USB devices should be blocked, by vendor ID, serial number, or device name.
      </p>
      <UsbPolicyListClient action="Block" />
    </div>
  );
}

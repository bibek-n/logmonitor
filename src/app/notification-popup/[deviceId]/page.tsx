import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import NotificationPopupClient from "@/components/notificationPopup/NotificationPopupClient";

export const dynamic = "force-dynamic";

// The target of the small app-mode window agent/tray_windows.go opens for an admin
// notification, replacing the old native balloon tip - see NotificationPopupClient for why.
// Same token-based auth as /chat/[deviceId] (the ChatToken is the same low-privilege
// credential the tray already holds; this is not a new credential to guard).
export default async function NotificationPopupPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ token?: string; message?: string }>;
}) {
  const { deviceId } = await params;
  const { token, message } = await searchParams;

  const device = await resolveDeviceChat(deviceId, token ?? null);

  if (!device || !message) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          textAlign: "center",
          background: "#1e1f22",
          color: "#f5f5f5",
        }}
      >
        <p style={{ fontSize: "0.85rem", color: "#999" }}>This notification link isn&apos;t valid.</p>
      </div>
    );
  }

  return <NotificationPopupClient deviceId={deviceId} token={token as string} message={message} />;
}

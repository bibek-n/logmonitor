import { resolveDeviceChat } from "@/lib/employeeChatAuth";
import RemoteSupportConsentClient from "@/components/remoteSupport/RemoteSupportConsentClient";

export const dynamic = "force-dynamic";

export default async function RemoteSupportConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ deviceId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { deviceId } = await params;
  const { token } = await searchParams;

  const device = await resolveDeviceChat(deviceId, token ?? null);

  if (!device) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
          background: "var(--bg)",
          color: "var(--ink)",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>This link isn&apos;t valid</h1>
          <p style={{ color: "var(--ink-muted)", fontSize: "0.9rem", margin: 0 }}>
            Please ask IT to send a new remote support request.
          </p>
        </div>
      </div>
    );
  }

  return <RemoteSupportConsentClient deviceId={deviceId} token={token as string} staffName={device.StaffName} />;
}

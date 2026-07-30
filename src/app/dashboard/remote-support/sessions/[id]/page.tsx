import Link from "next/link";
import { getRemoteSupportSession } from "@/lib/requireRemoteSupportPermission";
import { RemoteSupportSessionViewer } from "@/components/remoteSupport/RemoteSupportSessionViewer";

export const dynamic = "force-dynamic";

export default async function RemoteSupportSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = Number(id);

  const rs = await getRemoteSupportSession("remote_support_request");
  if (!rs) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Support Session</h1>
        <p style={{ color: "var(--danger)" }}>
          You don&apos;t have access to Remote Support, or your account needs two-factor authentication enabled first.
        </p>
      </div>
    );
  }

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Support Session</h1>
        <p style={{ color: "var(--danger)" }}>Invalid session id.</p>
      </div>
    );
  }

  return (
    <div>
      <Link href="/dashboard/remote-support" style={{ color: "var(--ink-muted)", fontSize: "0.82rem" }}>
        ← Back to devices
      </Link>
      <RemoteSupportSessionViewer sessionId={sessionId} />
    </div>
  );
}

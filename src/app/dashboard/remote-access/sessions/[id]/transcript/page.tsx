import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { SessionTranscriptClient } from "@/components/remoteAccess/SessionTranscriptClient";

export const dynamic = "force-dynamic";

export default async function SessionTranscriptPage({ params }: { params: Promise<{ id: string }> }) {
  const ra = await getRemoteAccessSession("ra_session_logs_view");
  const { id } = await params;
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Session Transcript</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to session logs.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Session Transcript</h1>
      <SessionTranscriptClient sessionId={Number(id)} />
    </div>
  );
}

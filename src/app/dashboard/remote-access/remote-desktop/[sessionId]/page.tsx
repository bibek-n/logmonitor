import { getDb, sql } from "@/lib/db";
import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { VncViewerClient } from "@/components/remoteAccess/VncViewerClient";
import { RdpViewerClient } from "@/components/remoteAccess/RdpViewerClient";

export const dynamic = "force-dynamic";

export default async function RemoteDesktopSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ w?: string; h?: string }>;
}) {
  const { sessionId } = await params;
  const { w, h } = await searchParams;

  const db = await getDb();
  const sessionRow = await db
    .request()
    .input("id", sql.Int, Number(sessionId))
    .query<{ SessionType: string }>("SELECT SessionType FROM RemoteSessions WHERE Id = @id");
  const sessionType = sessionRow.recordset[0]?.SessionType;
  const isRdp = sessionType === "Rdp";

  const ra = await getRemoteAccessSession(isRdp ? "ra_rdp_start" : "ra_vnc_start");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>Remote Desktop</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to use Remote Desktop.</p>
      </div>
    );
  }

  const width = Number(w) || (isRdp ? 1280 : 1024);
  const height = Number(h) || (isRdp ? 800 : 768);

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>Remote Desktop</h1>
      {isRdp ? (
        <RdpViewerClient sessionId={Number(sessionId)} width={width} height={height} />
      ) : (
        <VncViewerClient sessionId={Number(sessionId)} width={width} height={height} />
      )}
    </div>
  );
}

import { getRemoteAccessSession } from "@/lib/requireRemoteAccessPermission";
import { FileTransferClient } from "@/components/remoteAccess/FileTransferClient";

export const dynamic = "force-dynamic";

export default async function FileTransferPage() {
  const ra = await getRemoteAccessSession("ra_file_transfer_use");
  if (!ra) {
    return (
      <div>
        <h1 style={{ fontSize: "1.4rem" }}>File Transfer</h1>
        <p style={{ color: "var(--danger)" }}>You do not have access to File Transfer.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "1rem" }}>File Transfer</h1>
      <FileTransferClient />
    </div>
  );
}

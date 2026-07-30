import { createProtocolDiagnostic } from "./repository";

// SCTP connectivity diagnostics (Phase 2) - per the spec, SCTP support in this module is scoped
// STRICTLY to connectivity testing/diagnostics, never presented as a replacement for SSH, RDP,
// FTP, or any other remote-access protocol here.
//
// Node.js has no native SCTP socket support (net/dgram only cover TCP/UDP), and there is no
// pure-JS SCTP implementation in the npm ecosystem worth depending on for a real association
// test. A plain TCP connect to the same host:port would NOT be a valid substitute - SCTP and TCP
// are distinct transport protocols, so a TCP-reachable port proves nothing about SCTP
// reachability. Rather than fake a result (or silently mix in a misleading TCP check), this
// function always reports Status: 'NotSupported' with an honest explanation, and records the
// attempt so there's a real audit trail of "someone asked, here's the accurate answer." A real
// implementation needs an OS-level helper capable of speaking SCTP (e.g. a small native binary,
// or on Linux a tool like `sctp_test`) - not something buildable in pure Node.
export async function runSctpDiagnostic(host: string, port: number | null, userId: number): Promise<{
  status: "NotSupported";
  method: string;
  message: string;
}> {
  const method = "nodejs-no-native-sctp-support";
  const message =
    "SCTP connectivity testing is not available in this environment. Node.js has no native SCTP socket support, and a TCP-based check would not be a valid substitute for a real SCTP association test. This requires an OS-level helper that isn't part of this stack yet.";

  await createProtocolDiagnostic({ protocol: "SCTP", host, port, status: "NotSupported", method, message, ranByUserId: userId });

  return { status: "NotSupported", method, message };
}

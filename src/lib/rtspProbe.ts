import net from "net";

// Minimal RTSP reachability probe: opens a raw TCP socket to the stream URL's host:port and
// sends a bare DESCRIBE request, then waits for ANY RTSP-looking response line. Even a "401
// Unauthorized" counts as reachable — that still proves this specific channel/path is being
// served by the NVR, which is a meaningfully stronger signal than just a bare TCP connect
// against the NVR's shared RTSP port (which stays open even if one physical camera on that
// port's multiplexed channels is unplugged). No full RTSP/SDP client library — this only
// needs a fast yes/no reachability signal, called once per channel during NVR sync.
export function probeRtspStream(rtspUrl: string, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rtspUrl);
    } catch {
      resolve(false);
      return;
    }
    const port = url.port ? Number(url.port) : 554;
    const socket = net.connect({ host: url.hostname, port, timeout: timeoutMs });
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.on("connect", () => {
      const request = `DESCRIBE rtsp://${url.host}${url.pathname}${url.search} RTSP/1.0\r\nCSeq: 1\r\n\r\n`;
      socket.write(request);
    });
    socket.on("data", (chunk) => {
      finish(chunk.toString("utf8", 0, 20).startsWith("RTSP/1.0"));
    });
    socket.on("timeout", () => finish(false));
    socket.on("error", () => finish(false));
    socket.on("close", () => finish(false));
  });
}

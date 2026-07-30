import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { checkTcpReachability } from "./connectionService";

// checkTcpReachability is the single function shared by BOTH the manual "Test Connection"
// button and the scheduled Connection Checker (scripts/run-remote-access-connection-check.ts) -
// this is the concrete guard against the "status never updates" failure class (the still-open
// Website Monitoring stale-status bug this session flagged as a lesson to apply here).
describe("checkTcpReachability", () => {
  let server: net.Server;
  let openPort: number;

  beforeAll(async () => {
    server = net.createServer((socket) => socket.end());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    openPort = (server.address() as net.AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("reports Online with a latency figure for a reachable host:port", async () => {
    const result = await checkTcpReachability("127.0.0.1", openPort, 2000);
    expect(result.status).toBe("Online");
    expect(result.latencyMs).not.toBeNull();
    expect(result.latencyMs!).toBeGreaterThanOrEqual(0);
    expect(result.errorMessage).toBeNull();
  });

  it("reports Offline with an error message and null latency for a closed port", async () => {
    // Port 1 is a reserved/unassigned port that should refuse connections on localhost.
    const result = await checkTcpReachability("127.0.0.1", 1, 2000);
    expect(result.status).toBe("Offline");
    expect(result.latencyMs).toBeNull();
    expect(result.errorMessage).toBeTruthy();
  });

  it("reports Offline on timeout against a non-routable address, rather than hanging forever", async () => {
    // 10.255.255.1 is a non-routable address commonly used to force a connect timeout in tests.
    const result = await checkTcpReachability("10.255.255.1", 9, 300);
    expect(result.status).toBe("Offline");
    expect(result.latencyMs).toBeNull();
    expect(result.errorMessage).toBeTruthy();
  }, 5000);
});

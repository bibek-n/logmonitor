import net from "net";
import { describe, expect, it, afterEach } from "vitest";
import { RfbClient } from "./rfbClient";
import { vncAuthResponse } from "./des";

// These tests run a tiny hand-rolled fake RFB server on localhost - never a real VNC server or
// device - purely to exercise RfbClient's protocol framing (version/security/init handshake,
// Raw rectangle decoding, pixel-format forcing) end-to-end without any live target.

function listen(server: net.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as net.AddressInfo).port));
  });
}

const openServers: net.Server[] = [];
const openClients: RfbClient[] = [];

afterEach(() => {
  for (const c of openClients) c.disconnect();
  openClients.length = 0;
  for (const s of openServers) s.close();
  openServers.length = 0;
});

describe("RfbClient", () => {
  it("completes a None-security handshake and decodes a Raw framebuffer update", async () => {
    const server = net.createServer((socket) => {
      socket.write("RFB 003.008\n");
      socket.once("data", () => {
        // client's version reply consumed; now offer security types
        socket.write(Buffer.from([1, 1])); // count=1, type=1 (None)
        socket.once("data", () => {
          // client's chosen security type (1 byte) consumed
          socket.write(Buffer.from([0, 0, 0, 0])); // SecurityResult OK
          socket.once("data", () => {
            // ClientInit consumed
            const init = Buffer.alloc(24);
            init.writeUInt16BE(4, 0); // width
            init.writeUInt16BE(2, 2); // height
            init.writeUInt32BE(4, 20); // name length
            socket.write(init);
            socket.write(Buffer.from("test"));

            let setupBytes = 0;
            const onSetup = (chunk: Buffer) => {
              setupBytes += chunk.length;
              // SetPixelFormat(20) + SetEncodings(8) + FramebufferUpdateRequest(10) = 38 bytes
              if (setupBytes >= 38) {
                socket.removeListener("data", onSetup);
                const rect = Buffer.alloc(12);
                rect.writeUInt16BE(0, 0); // x
                rect.writeUInt16BE(0, 2); // y
                rect.writeUInt16BE(4, 4); // w
                rect.writeUInt16BE(2, 6); // h
                rect.writeInt32BE(0, 8); // Raw encoding
                // 4x2 pixels, each [R,G,B,pad] per the pixel format RfbClient always requests
                const pixels = Buffer.from([
                  255, 0, 0, 9, 0, 255, 0, 9, 0, 0, 255, 9, 10, 20, 30, 9,
                  40, 50, 60, 9, 70, 80, 90, 9, 100, 110, 120, 9, 130, 140, 150, 9,
                ]);
                const update = Buffer.alloc(4);
                update[0] = 0; // FramebufferUpdate
                update.writeUInt16BE(1, 2); // number-of-rectangles
                socket.write(Buffer.concat([update, rect, pixels]));
              }
            };
            socket.on("data", onSetup);
          });
        });
      });
    });
    openServers.push(server);
    const port = await listen(server);

    const client = new RfbClient({ host: "127.0.0.1", port });
    openClients.push(client);

    const ready = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      client.on("ready", resolve);
      client.on("error", reject);
    });
    expect(ready.width).toBe(4);
    expect(ready.height).toBe(2);

    await new Promise<void>((resolve, reject) => {
      client.on("frame", resolve);
      client.on("error", reject);
    });

    // Alpha (every 4th byte) must always read 255 regardless of the arbitrary "padding" byte
    // (9 in this test) the fake server sent on the wire.
    expect(Array.from(client.frameBuffer)).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 255,
      40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255, 130, 140, 150, 255,
    ]);
  });

  it("answers a VNC Authentication challenge with the correct DES response", async () => {
    const challenge = Buffer.from("00112233445566778899aabbccddeeff".slice(0, 32), "hex");
    const password = "s3cret!";
    let capturedResponse: Buffer | null = null;

    const server = net.createServer((socket) => {
      socket.write("RFB 003.008\n");
      socket.once("data", () => {
        socket.write(Buffer.from([1, 2])); // count=1, type=2 (VNC Authentication)
        socket.once("data", (chosen: Buffer) => {
          expect(chosen[0]).toBe(2);
          socket.write(challenge);
          socket.once("data", (response: Buffer) => {
            capturedResponse = Buffer.from(response);
            const reason = Buffer.from("deliberate test failure");
            const reasonLen = Buffer.alloc(4);
            reasonLen.writeUInt32BE(reason.length, 0);
            // SecurityResult: fail (1), followed by the RFB 3.8-mandated reason string -
            // ends the test here, cleanly, once RfbClient surfaces that reason as its error.
            socket.write(Buffer.concat([Buffer.from([0, 0, 0, 1]), reasonLen, reason]));
          });
        });
      });
    });
    openServers.push(server);
    const port = await listen(server);

    const client = new RfbClient({ host: "127.0.0.1", port, password });
    openClients.push(client);

    await new Promise<void>((resolve) => {
      client.on("error", () => resolve()); // expected: auth deliberately fails server-side above
    });

    expect(capturedResponse).toEqual(vncAuthResponse(password, challenge));
  });

  it("fails with a clear error when the server only offers an unsupported security type", async () => {
    const server = net.createServer((socket) => {
      socket.write("RFB 003.008\n");
      socket.once("data", () => {
        socket.write(Buffer.from([1, 19])); // count=1, type=19 (VeNCrypt) - not supported
      });
    });
    openServers.push(server);
    const port = await listen(server);

    const client = new RfbClient({ host: "127.0.0.1", port });
    openClients.push(client);

    const err = await new Promise<Error>((resolve) => client.on("error", resolve));
    expect(err.message).toMatch(/unsupported security type/i);
  });
});

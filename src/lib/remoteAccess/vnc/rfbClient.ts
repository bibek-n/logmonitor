import net from "net";
import { EventEmitter } from "events";
import { vncAuthResponse } from "./des";

// Minimal RFB (VNC) 3.8 client, scoped to exactly what this feature needs: connect, authenticate
// (None or VNC Authentication only - see below), force a known 32bpp true-colour pixel format so
// decoding is trivial, and decode Raw-encoded FramebufferUpdate rectangles into an in-memory RGBA
// buffer. No CopyRect/Hextile/ZRLE/Tight support - we only ever advertise Raw in SetEncodings
// (fully spec-compliant: every RFB server must support Raw), which keeps the decoder small and
// unambiguous at the cost of extra bandwidth per update. That's an acceptable trade here because
// this app's hosting (IIS/iisnode) can't run a persistent WebSocket well (see
// remoteSupport/signalingRelay.ts's comment on the same constraint), so the browser side already
// polls for frames every ~250ms rather than rendering a continuous server push - there is no
// "continuous stream" for a fancier encoding to economize on.
//
// Security types supported: None (1) and VNC Authentication (2, DES challenge-response). NOT
// supported: VeNCrypt/TLS/SASL/RA2 or anything requiring a TLS handshake inside the RFB stream -
// connecting to a server that only offers those fails with a clear, named error instead of
// hanging.

const SECURITY_NONE = 1;
const SECURITY_VNC_AUTH = 2;

class ByteReader {
  private buf: Buffer = Buffer.alloc(0);
  private waiter: { n: number; resolve: (b: Buffer) => void; reject: (e: Error) => void } | null = null;
  private failed: Error | null = null;

  push(chunk: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    this.drain();
  }

  fail(err: Error) {
    this.failed = err;
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w.reject(err);
    }
  }

  private drain() {
    if (this.waiter && this.buf.length >= this.waiter.n) {
      const { n, resolve } = this.waiter;
      this.waiter = null;
      const out = this.buf.subarray(0, n);
      this.buf = this.buf.subarray(n);
      resolve(out);
    }
  }

  readExactly(n: number): Promise<Buffer> {
    if (this.failed) return Promise.reject(this.failed);
    if (this.buf.length >= n) {
      const out = this.buf.subarray(0, n);
      this.buf = this.buf.subarray(n);
      return Promise.resolve(out);
    }
    return new Promise((resolve, reject) => {
      this.waiter = { n, resolve, reject };
    });
  }
}

export interface RfbClientOptions {
  host: string;
  port: number;
  password?: string | null;
  connectTimeoutMs?: number;
}

export declare interface RfbClient {
  on(event: "ready", listener: (info: { width: number; height: number; name: string }) => void): this;
  on(event: "frame", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: () => void): this;
}

export class RfbClient extends EventEmitter {
  private socket: net.Socket;
  private reader = new ByteReader();
  private closed = false;
  private destroyed = false;

  width = 0;
  height = 0;
  /** Tightly packed RGBA, width*height*4 bytes, alpha always forced to 255. */
  frameBuffer: Buffer = Buffer.alloc(0);

  constructor(private opts: RfbClientOptions) {
    super();
    this.socket = net.createConnection({ host: opts.host, port: opts.port, timeout: opts.connectTimeoutMs ?? 10_000 });
    this.socket.once("connect", () => this.socket.setTimeout(0));
    this.socket.on("data", (chunk) => this.reader.push(chunk));
    this.socket.once("error", (err) => this.fail(err));
    this.socket.once("timeout", () => this.fail(new Error(`Connection to ${opts.host}:${opts.port} timed out`)));
    this.socket.once("close", () => {
      if (!this.destroyed) {
        this.destroyed = true;
        this.emit("close");
      }
    });

    this.run().catch((err) => this.fail(err instanceof Error ? err : new Error(String(err))));
  }

  private fail(err: Error) {
    if (this.closed) return;
    this.closed = true;
    this.reader.fail(err);
    this.emit("error", err);
    this.socket.destroy();
  }

  disconnect() {
    if (this.closed) return;
    this.closed = true;
    this.socket.destroy();
  }

  private async run() {
    const versionLine = await this.reader.readExactly(12); // "RFB 003.00X\n"
    const match = /^RFB (\d{3})\.(\d{3})\n$/.exec(versionLine.toString("ascii"));
    if (!match) throw new Error("Not a VNC/RFB server (bad protocol version handshake)");
    const serverMajor = Number(match[1]);
    const serverMinor = Number(match[2]);
    this.socket.write("RFB 003.008\n");

    const isLegacyHandshake = serverMajor < 3 || (serverMajor === 3 && serverMinor < 7);
    let securityType: number;

    if (isLegacyHandshake) {
      const secBuf = await this.reader.readExactly(4);
      securityType = secBuf.readUInt32BE(0);
      if (securityType === 0) throw new Error(await this.readFailureReason());
    } else {
      const countBuf = await this.reader.readExactly(1);
      const count = countBuf[0];
      if (count === 0) throw new Error(await this.readFailureReason());
      const types = await this.reader.readExactly(count);
      const offered = Array.from(types);
      securityType = offered.includes(SECURITY_NONE)
        ? SECURITY_NONE
        : offered.includes(SECURITY_VNC_AUTH)
          ? SECURITY_VNC_AUTH
          : -1;
      if (securityType === -1) {
        throw new Error(
          `This VNC server only offers unsupported security type(s) [${offered.join(", ")}] - only None (1) and VNC Authentication (2) are supported.`
        );
      }
      this.socket.write(Buffer.from([securityType]));
    }

    if (securityType === SECURITY_VNC_AUTH) {
      if (!this.opts.password) throw new Error("This VNC server requires a password, but none is configured for this connection.");
      const challenge = await this.reader.readExactly(16);
      this.socket.write(vncAuthResponse(this.opts.password, challenge));
    }

    const expectSecurityResult = !isLegacyHandshake || securityType === SECURITY_VNC_AUTH;
    if (expectSecurityResult) {
      const resultBuf = await this.reader.readExactly(4);
      if (resultBuf.readUInt32BE(0) !== 0) {
        throw new Error(isLegacyHandshake ? "VNC authentication failed." : await this.readFailureReason());
      }
    }

    // ClientInit: shared-flag = 1 (don't disconnect any other viewer already attached).
    this.socket.write(Buffer.from([1]));

    const serverInitHeader = await this.reader.readExactly(24); // width(2)+height(2)+pixelformat(16)+namelen(4)
    this.width = serverInitHeader.readUInt16BE(0);
    this.height = serverInitHeader.readUInt16BE(2);
    const nameLen = serverInitHeader.readUInt32BE(20);
    const nameBuf = nameLen > 0 ? await this.reader.readExactly(nameLen) : Buffer.alloc(0);
    const name = nameBuf.toString("utf8");

    if (this.width <= 0 || this.height <= 0 || this.width > 10_000 || this.height > 10_000) {
      throw new Error(`Server reported an implausible framebuffer size (${this.width}x${this.height}).`);
    }
    this.frameBuffer = Buffer.alloc(this.width * this.height * 4, 0);
    for (let i = 3; i < this.frameBuffer.length; i += 4) this.frameBuffer[i] = 255; // alpha opaque

    this.sendSetPixelFormat();
    this.sendSetEncodings();
    this.requestUpdate(false);

    this.emit("ready", { width: this.width, height: this.height, name });

    for (;;) {
      await this.readServerMessage();
    }
  }

  private async readFailureReason(): Promise<string> {
    try {
      const lenBuf = await this.reader.readExactly(4);
      const len = lenBuf.readUInt32BE(0);
      const reasonBuf = await this.reader.readExactly(len);
      return `VNC server rejected the connection: ${reasonBuf.toString("utf8")}`;
    } catch {
      return "VNC server rejected the connection.";
    }
  }

  private sendSetPixelFormat() {
    // 32bpp, depth 24, little-endian, true-colour, shifts chosen so byte order in the wire data
    // is [R, G, B, pad] per pixel - directly usable as an RGBA buffer with alpha forced to 255.
    const msg = Buffer.alloc(20);
    msg[0] = 0; // SetPixelFormat
    // bytes 1-3 padding (already 0)
    msg[4] = 32; // bits-per-pixel
    msg[5] = 24; // depth
    msg[6] = 0; // big-endian-flag
    msg[7] = 1; // true-colour-flag
    msg.writeUInt16BE(255, 8); // red-max
    msg.writeUInt16BE(255, 10); // green-max
    msg.writeUInt16BE(255, 12); // blue-max
    msg[14] = 0; // red-shift
    msg[15] = 8; // green-shift
    msg[16] = 16; // blue-shift
    // bytes 17-19 padding
    this.socket.write(msg);
  }

  private sendSetEncodings() {
    const msg = Buffer.alloc(8);
    msg[0] = 2; // SetEncodings
    msg[1] = 0; // padding
    msg.writeUInt16BE(1, 2); // number-of-encodings
    msg.writeInt32BE(0, 4); // Raw only
    this.socket.write(msg);
  }

  requestUpdate(incremental: boolean) {
    if (this.closed || this.width === 0) return;
    const msg = Buffer.alloc(10);
    msg[0] = 3; // FramebufferUpdateRequest
    msg[1] = incremental ? 1 : 0;
    msg.writeUInt16BE(0, 2); // x
    msg.writeUInt16BE(0, 4); // y
    msg.writeUInt16BE(this.width, 6);
    msg.writeUInt16BE(this.height, 8);
    this.socket.write(msg);
  }

  sendPointerEvent(x: number, y: number, buttonMask: number) {
    if (this.closed) return;
    const msg = Buffer.alloc(6);
    msg[0] = 5; // PointerEvent
    msg[1] = buttonMask & 0xff;
    msg.writeUInt16BE(Math.max(0, Math.min(this.width - 1, Math.round(x))), 2);
    msg.writeUInt16BE(Math.max(0, Math.min(this.height - 1, Math.round(y))), 4);
    this.socket.write(msg);
  }

  sendKeyEvent(keysym: number, down: boolean) {
    if (this.closed) return;
    const msg = Buffer.alloc(8);
    msg[0] = 4; // KeyEvent
    msg[1] = down ? 1 : 0;
    // bytes 2-3 padding
    msg.writeUInt32BE(keysym >>> 0, 4);
    this.socket.write(msg);
  }

  private async readServerMessage() {
    const typeBuf = await this.reader.readExactly(1);
    switch (typeBuf[0]) {
      case 0:
        return this.readFramebufferUpdate();
      case 1:
        return this.readSetColourMapEntries();
      case 2:
        return; // Bell - no payload
      case 3:
        return this.readServerCutText();
      default:
        throw new Error(`Unexpected RFB server message type ${typeBuf[0]}`);
    }
  }

  private async readFramebufferUpdate() {
    const header = await this.reader.readExactly(3); // padding(1) + number-of-rectangles(2)
    const numRects = header.readUInt16BE(1);
    let changed = false;
    for (let i = 0; i < numRects; i++) {
      const rectHeader = await this.reader.readExactly(12);
      const x = rectHeader.readUInt16BE(0);
      const y = rectHeader.readUInt16BE(2);
      const w = rectHeader.readUInt16BE(4);
      const h = rectHeader.readUInt16BE(6);
      const encoding = rectHeader.readInt32BE(8);
      if (encoding !== 0) {
        throw new Error(`Server sent unsupported encoding type ${encoding} despite only Raw (0) being advertised.`);
      }
      await this.readRawRect(x, y, w, h);
      changed = true;
    }
    if (changed) this.emit("frame");
  }

  private async readRawRect(x: number, y: number, w: number, h: number) {
    if (w === 0 || h === 0) return;
    const rowBytes = w * 4;
    for (let row = 0; row < h; row++) {
      const rowData = await this.reader.readExactly(rowBytes);
      const destY = y + row;
      if (destY >= this.height) continue; // defensive - shouldn't happen against a well-behaved server
      const destRowStart = (destY * this.width + x) * 4;
      const copyWidth = Math.min(w, this.width - x);
      rowData.copy(this.frameBuffer, destRowStart, 0, copyWidth * 4);
      for (let col = 0; col < copyWidth; col++) this.frameBuffer[destRowStart + col * 4 + 3] = 255;
    }
  }

  private async readSetColourMapEntries() {
    const header = await this.reader.readExactly(5); // padding(1) + first-colour(2) + number-of-colours(2)
    const numColours = header.readUInt16BE(3);
    if (numColours > 0) await this.reader.readExactly(numColours * 6);
  }

  private async readServerCutText() {
    const header = await this.reader.readExactly(7); // padding(3) + length(4)
    const len = header.readUInt32BE(3);
    if (len > 0) await this.reader.readExactly(len);
  }
}

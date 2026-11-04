import net from "net";
import { EventEmitter } from "events";
import sharp from "sharp";
import { encodeInstruction, GuacdInstructionReader } from "./protocol";

// Minimal Guacamole protocol client, scoped to exactly what in-browser RDP viewing needs: talk
// to a local guacd (the Apache Guacamole proxy daemon - see [[project_logmonitor_remote_access_module]]
// deploy notes for why it runs on 192.168.1.13 behind an SSH tunnel rather than on this app
// server), negotiate an RDP connection, and maintain an in-memory composited RGBA framebuffer the
// same way vnc/rfbClient.ts does - so the rest of this app's polling-frame architecture
// (sessionService encodes it to JPEG on a timer, the browser polls for it) works identically for
// RDP as it already does for VNC, with no special-casing needed above this client.
//
// Every layer Guacamole references is tracked, not just the root display (layer 0) - confirmed
// live (2026-11-02) that guacd's RDP backend draws into an offscreen buffer layer (a negative
// index) and then `copy`s the finished frame onto layer 0, so an earlier version of this client
// that only composited layer 0 directly produced a permanently black display despite a fully
// working, authenticated RDP session (mstsc to the same host worked fine the whole time). Buffer
// layers are implicitly created/grown by whatever first draws into them (the protocol has no
// explicit "create buffer" opcode) and preserve content across growth; layer 0's size is
// authoritative only via an explicit `size` instruction or the initial handshake.
//
// Deliberate simplifications (documented so a real-world gap has an obvious place to be fixed):
// - `rect`+`cfill` (solid-color fill) is handled via one pending rect per layer rather than
//   Guacamole's full stateful path/stroke drawing model - adequate for the simple background/
//   block fills RDP typically uses it for, not a general 2D path renderer.
// - Compositing is a plain overwrite blit (the decoded tile's own pixels replace the destination
//   outright) rather than true Porter-Duff alpha blending per the `mask` channel-mask code -
//   correct for the overwhelmingly common "draw this opaque tile" case (mask 0x0E, "A over B").
// - `move` (repositioning/reparenting a layer) is parsed enough not to break the protocol stream
//   but not applied - layers are always composited at the position their own draws/copies used,
//   not wherever a `move` instruction later relocated them. No remote cursor icon is composited
//   either (same visible limitation the VNC viewer already has).

const GUACD_HOST = "127.0.0.1";
const GUACD_PORT = 4822;

// Image stream mimetypes we advertise support for decoding (via sharp/libvips) - deliberately
// just these two, mirroring rfbClient's "keep the decoder small" philosophy.
const SUPPORTED_IMAGE_MIMETYPES = ["image/png", "image/jpeg"];

class InstructionQueue {
  private queued: string[][] = [];
  private waiter: { resolve: (i: string[]) => void; reject: (e: Error) => void } | null = null;
  private failed: Error | null = null;

  push(instructions: string[][]) {
    for (const instr of instructions) {
      if (this.waiter) {
        const { resolve } = this.waiter;
        this.waiter = null;
        resolve(instr);
      } else {
        this.queued.push(instr);
      }
    }
  }

  fail(err: Error) {
    this.failed = err;
    if (this.waiter) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(err);
    }
  }

  next(): Promise<string[]> {
    if (this.queued.length > 0) return Promise.resolve(this.queued.shift()!);
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
    });
  }
}

export interface GuacdClientOptions {
  host: string;
  port: number;
  username?: string | null;
  password?: string | null;
  domain?: string | null;
  width: number;
  height: number;
  connectTimeoutMs?: number;
}

export declare interface GuacdClient {
  on(event: "ready", listener: (info: { width: number; height: number }) => void): this;
  on(event: "frame", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  on(event: "close", listener: () => void): this;
}

interface Layer {
  width: number;
  height: number;
  data: Buffer; // RGBA
}

export class GuacdClient extends EventEmitter {
  private socket: net.Socket;
  private reader = new GuacdInstructionReader();
  private queue = new InstructionQueue();
  private closed = false;
  private destroyed = false;
  // Non-zero layers only - layer 0 (the root display) is always this.frameBuffer/width/height,
  // the one external code (rdpSessionService) actually reads.
  private layers = new Map<number, Layer>();
  private pendingRects = new Map<number, { x: number; y: number; width: number; height: number }>();

  width: number;
  height: number;
  /** Tightly packed RGBA, width*height*4 bytes - the composited root display (layer 0). */
  frameBuffer: Buffer;

  constructor(private opts: GuacdClientOptions) {
    super();
    this.width = opts.width;
    this.height = opts.height;
    this.frameBuffer = Buffer.alloc(this.width * this.height * 4, 0);
    for (let i = 3; i < this.frameBuffer.length; i += 4) this.frameBuffer[i] = 255; // alpha opaque

    this.socket = net.createConnection({ host: GUACD_HOST, port: GUACD_PORT, timeout: opts.connectTimeoutMs ?? 10_000 });
    this.socket.once("connect", () => this.socket.setTimeout(0));
    this.socket.on("data", (chunk) => {
      try {
        this.reader.push(chunk);
        this.queue.push(this.reader.drain());
      } catch (err) {
        this.fail(err instanceof Error ? err : new Error(String(err)));
      }
    });
    this.socket.once("error", (err) =>
      this.fail(new Error(`Could not reach guacd at ${GUACD_HOST}:${GUACD_PORT} - ${err.message}`))
    );
    this.socket.once("timeout", () => this.fail(new Error(`Connection to guacd at ${GUACD_HOST}:${GUACD_PORT} timed out`)));
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
    this.queue.fail(err);
    this.emit("error", err);
    this.socket.destroy();
  }

  disconnect() {
    if (this.closed) return;
    this.closed = true;
    try {
      this.socket.write(encodeInstruction("disconnect"));
    } catch {
      // best-effort courtesy notice only - the socket destroy below is what actually matters
    }
    this.socket.destroy();
  }

  private send(opcode: string, args: (string | number)[] = []) {
    if (this.closed) return;
    this.socket.write(encodeInstruction(opcode, args));
  }

  private async run() {
    this.send("select", ["rdp"]);

    const argsInstr = await this.queue.next();
    if (argsInstr[0] !== "args") throw new Error(`Expected "args" from guacd, got "${argsInstr[0]}"`);
    const version = argsInstr[1];
    const paramNames = argsInstr.slice(2);

    const values: Record<string, string> = {
      hostname: this.opts.host,
      port: String(this.opts.port),
      username: this.opts.username || "",
      password: this.opts.password || "",
      domain: this.opts.domain || "",
      security: "any",
      "ignore-cert": "true",
      width: String(this.opts.width),
      height: String(this.opts.height),
      dpi: "96",
      "resize-method": "display-update",
      "server-layout": "en-us-qwerty",
    };

    this.send("size", [this.opts.width, this.opts.height, 96]);
    this.send("audio");
    this.send("video");
    this.send("image", SUPPORTED_IMAGE_MIMETYPES);
    this.send("connect", [version, ...paramNames.map((name) => values[name] ?? "")]);

    // Skip any diagnostic/log instructions guacd may send before the connection settles; only
    // "ready" (success) or "error" (failure) end the negotiation.
    for (;;) {
      const instr = await this.queue.next();
      if (instr[0] === "ready") break;
      if (instr[0] === "error") throw new Error(`RDP connection rejected: ${instr[1] || "unknown error"}`);
      if (instr[0] === "disconnect") throw new Error("guacd closed the connection before it was ready.");
    }

    this.emit("ready", { width: this.width, height: this.height });

    for (;;) {
      const instr = await this.queue.next();
      await this.handleInstruction(instr);
    }
  }

  // Active image streams (started by "img", filled by "blob", finished by "end").
  private streams = new Map<number, { chunks: Buffer[]; layer: number; x: number; y: number }>();

  private async handleInstruction(instr: string[]) {
    const [opcode, ...args] = instr;
    switch (opcode) {
      case "img": {
        // args order: stream, mask, layer, mimetype, x, y - confirmed against guacd 1.6.0's
        // actual wire output (2026-11-02); mask/mimetype are unused in v1 (see class comment:
        // sharp auto-detects format, and compositing is a plain overwrite blit).
        const stream = Number(args[0]);
        const layer = Number(args[2]);
        const x = Number(args[4]);
        const y = Number(args[5]);
        this.streams.set(stream, { chunks: [], layer, x, y });
        return;
      }
      case "blob": {
        const [streamStr, data] = args;
        const stream = Number(streamStr);
        const active = this.streams.get(stream);
        if (active) active.chunks.push(Buffer.from(data, "base64"));
        this.send("ack", [stream, "OK", 0]);
        return;
      }
      case "end": {
        const stream = Number(args[0]);
        const active = this.streams.get(stream);
        this.streams.delete(stream);
        if (active) await this.compositeTile(active);
        return;
      }
      case "size": {
        // Drawing-side size (resize a layer) - args: layer, width, height. Authoritative: clears
        // to a fresh buffer at the new dimensions, same as the implicit "already this size"
        // allocation every layer starts with.
        const layer = Number(args[0]);
        const width = Number(args[1]);
        const height = Number(args[2]);
        if (layer === 0) this.resizeRoot(width, height);
        else if (width > 0 && height > 0 && width <= 10_000 && height <= 10_000) {
          this.layers.set(layer, { width, height, data: Buffer.alloc(width * height * 4, 0) });
        }
        return;
      }
      case "rect": {
        // args: mask, layer, x, y, width, height - remembered per layer for the next cfill (see
        // class comment).
        const layer = Number(args[1]);
        this.pendingRects.set(layer, { x: Number(args[2]), y: Number(args[3]), width: Number(args[4]), height: Number(args[5]) });
        return;
      }
      case "cfill": {
        // args: mask, layer, r, g, b, a
        const layer = Number(args[1]);
        const rect = this.pendingRects.get(layer);
        if (rect) {
          this.fillRect(layer, rect, Number(args[2]), Number(args[3]), Number(args[4]), Number(args[5]));
          this.pendingRects.delete(layer);
        }
        return;
      }
      case "copy": {
        // args: srclayer, srcx, srcy, srcwidth, srcheight, mask, dstlayer, dstx, dsty
        this.copyRect(Number(args[0]), Number(args[1]), Number(args[2]), Number(args[3]), Number(args[4]), Number(args[6]), Number(args[7]), Number(args[8]));
        return;
      }
      case "dispose": {
        const layer = Number(args[0]);
        this.layers.delete(layer);
        this.pendingRects.delete(layer);
        return;
      }
      case "sync":
        // Echoing the timestamp back is not just a latency courtesy - guacd actively uses it as
        // a client liveness check and disconnects with "User is not responding" if it never
        // hears back (confirmed live: RDP auth succeeded, guacd logged "RDPDR user logged on",
        // then killed the connection for exactly this reason since nothing was ever echoed).
        this.send("sync", [args[0]]);
        this.emit("frame"); // the true frame-boundary signal - see class comment
        return;
      case "error":
        throw new Error(`guacd reported an error: ${args[0] || "unknown error"}`);
      case "disconnect":
        this.disconnect();
        return;
      default:
        return; // move/cursor/name/msg/log/... - intentionally not implemented, see class comment
    }
  }

  private resizeRoot(width: number, height: number) {
    if (width <= 0 || height <= 0 || width > 10_000 || height > 10_000) return;
    this.width = width;
    this.height = height;
    this.frameBuffer = Buffer.alloc(width * height * 4, 0);
    for (let i = 3; i < this.frameBuffer.length; i += 4) this.frameBuffer[i] = 255;
  }

  /** Current dimensions/backing buffer for any layer index, root (0) or offscreen. */
  private getLayerData(index: number): Layer {
    if (index === 0) return { width: this.width, height: this.height, data: this.frameBuffer };
    return this.layers.get(index) ?? { width: 0, height: 0, data: Buffer.alloc(0) };
  }

  // Offscreen (non-zero) layers have no explicit "create" opcode - the protocol just starts
  // drawing into them, growing as later draws extend past the current bounds. Existing content
  // is preserved across growth. Layer 0's size only ever changes via an explicit `size`
  // instruction (see resizeRoot) - this is a no-op for it.
  private growBufferLayer(index: number, minWidth: number, minHeight: number) {
    if (index === 0) return;
    const existing = this.layers.get(index);
    if (existing && existing.width >= minWidth && existing.height >= minHeight) return;
    const width = Math.max(minWidth, existing?.width ?? 0);
    const height = Math.max(minHeight, existing?.height ?? 0);
    if (width <= 0 || height <= 0 || width > 10_000 || height > 10_000) return;
    const data = Buffer.alloc(width * height * 4, 0);
    if (existing) {
      for (let row = 0; row < existing.height; row++) {
        const srcStart = row * existing.width * 4;
        existing.data.copy(data, row * width * 4, srcStart, srcStart + existing.width * 4);
      }
    }
    this.layers.set(index, { width, height, data });
  }

  /** Blits srcData (tightly-packed RGBA, srcWidth x srcHeight) onto any layer at (destX, destY). */
  private blitInto(destIndex: number, destX: number, destY: number, srcData: Buffer, srcWidth: number, srcHeight: number) {
    if (destX < 0 || destY < 0) return;
    this.growBufferLayer(destIndex, destX + srcWidth, destY + srcHeight);
    const dest = this.getLayerData(destIndex);
    const copyWidth = Math.min(srcWidth, dest.width - destX);
    const copyHeight = Math.min(srcHeight, dest.height - destY);
    if (copyWidth <= 0 || copyHeight <= 0) return;
    for (let row = 0; row < copyHeight; row++) {
      const srcStart = row * srcWidth * 4;
      const destStart = ((destY + row) * dest.width + destX) * 4;
      srcData.copy(dest.data, destStart, srcStart, srcStart + copyWidth * 4);
    }
  }

  private async compositeTile(stream: { chunks: Buffer[]; layer: number; x: number; y: number }) {
    if (stream.chunks.length === 0) return;
    try {
      const raw = await sharp(Buffer.concat(stream.chunks)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      this.blitInto(stream.layer, stream.x, stream.y, raw.data, raw.info.width, raw.info.height);
    } catch {
      // A single malformed/undecodable tile shouldn't kill the session - skip it, the next
      // sync'd frame will likely include a corrected redraw of the same region anyway.
    }
  }

  private fillRect(layerIndex: number, rect: { x: number; y: number; width: number; height: number }, r: number, g: number, b: number, a: number) {
    this.growBufferLayer(layerIndex, rect.x + rect.width, rect.y + rect.height);
    const layer = this.getLayerData(layerIndex);
    const x0 = Math.max(0, rect.x);
    const y0 = Math.max(0, rect.y);
    const x1 = Math.min(layer.width, rect.x + rect.width);
    const y1 = Math.min(layer.height, rect.y + rect.height);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * layer.width + x) * 4;
        layer.data[i] = r;
        layer.data[i + 1] = g;
        layer.data[i + 2] = b;
        layer.data[i + 3] = a;
      }
    }
  }

  private copyRect(srcIndex: number, srcX: number, srcY: number, srcWidth: number, srcHeight: number, dstIndex: number, dstX: number, dstY: number) {
    const src = this.getLayerData(srcIndex);
    const copyWidth = Math.min(srcWidth, src.width - srcX);
    const copyHeight = Math.min(srcHeight, src.height - srcY);
    if (copyWidth <= 0 || copyHeight <= 0 || srcX < 0 || srcY < 0) return;
    // Snapshot the source region into its own buffer first - source and destination may be the
    // same layer and overlap (e.g. scroll-in-place), or may differ in width, so a direct row
    // copy into the destination isn't safe.
    const snapshot = Buffer.alloc(copyWidth * copyHeight * 4);
    for (let row = 0; row < copyHeight; row++) {
      const srcStart = ((srcY + row) * src.width + srcX) * 4;
      src.data.copy(snapshot, row * copyWidth * 4, srcStart, srcStart + copyWidth * 4);
    }
    this.blitInto(dstIndex, dstX, dstY, snapshot, copyWidth, copyHeight);
  }

  sendPointerEvent(x: number, y: number, buttonMask: number) {
    if (this.closed) return;
    this.send("mouse", [Math.max(0, Math.min(this.width - 1, Math.round(x))), Math.max(0, Math.min(this.height - 1, Math.round(y))), buttonMask]);
  }

  sendKeyEvent(keysym: number, down: boolean) {
    if (this.closed) return;
    this.send("key", [keysym, down ? 1 : 0]);
  }
}

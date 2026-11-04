// Minimal Guacamole text protocol encode/decode. Wire format (per the official protocol spec):
// an instruction is a comma-separated list of length-prefixed elements terminated by ';' - each
// element is "<charCount>.<value>". The spec counts Unicode *characters*, not bytes, but every
// value this client ever sends or receives is ASCII-only (hostnames, numbers, base64 image data,
// X11 keysyms) - byte count and character count are identical for ASCII, so treating charCount as
// a byte count throughout is exact for everything this feature actually transmits.

export function encodeInstruction(opcode: string, args: (string | number)[] = []): Buffer {
  const parts = [opcode, ...args.map(String)];
  const encoded = parts.map((p) => `${Buffer.byteLength(p, "utf8")}.${p}`).join(",");
  return Buffer.from(`${encoded};`, "utf8");
}

// Buffers raw socket bytes and yields complete parsed instructions as they become available.
// Mirrors vnc/rfbClient.ts's ByteReader in spirit (accumulate-and-reparse), but at the
// instruction level instead of a fixed byte count, since Guacamole instructions are
// self-delimiting via their own length prefixes rather than a known fixed size.
export class GuacdInstructionReader {
  private buf: Buffer = Buffer.alloc(0);

  push(chunk: Buffer) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
  }

  /** Pulls and removes every complete instruction currently buffered; [] if none yet. */
  drain(): string[][] {
    const instructions: string[][] = [];
    for (;;) {
      const parsed = this.tryParseOne();
      if (!parsed) break;
      instructions.push(parsed);
    }
    return instructions;
  }

  private tryParseOne(): string[] | null {
    let pos = 0;
    const elements: string[] = [];
    for (;;) {
      const dot = this.buf.indexOf(0x2e /* '.' */, pos);
      if (dot === -1) return null; // incomplete - wait for more data
      const lenStr = this.buf.subarray(pos, dot).toString("ascii");
      const len = Number(lenStr);
      if (!Number.isInteger(len) || len < 0) {
        throw new Error(`Malformed Guacamole instruction: bad element length "${lenStr}"`);
      }
      const valueStart = dot + 1;
      const valueEnd = valueStart + len;
      if (this.buf.length < valueEnd + 1) return null; // value and/or its separator not fully buffered yet
      const value = this.buf.subarray(valueStart, valueEnd).toString("utf8");
      elements.push(value);
      const sep = this.buf[valueEnd];
      if (sep === 0x3b /* ';' */) {
        this.buf = this.buf.subarray(valueEnd + 1);
        return elements;
      }
      if (sep !== 0x2c /* ',' */) {
        throw new Error("Malformed Guacamole instruction: expected ',' or ';' after element");
      }
      pos = valueEnd + 1;
    }
  }
}

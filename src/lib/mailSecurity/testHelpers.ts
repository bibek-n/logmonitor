import yazl from "yazl";

export function buildZipBuffer(entries: { name: string; content: Buffer; compress?: boolean }[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    for (const entry of entries) {
      zip.addBuffer(entry.content, entry.name, { compress: entry.compress ?? true });
    }
    zip.end();

    const chunks: Buffer[] = [];
    zip.outputStream.on("data", (c: Buffer) => chunks.push(c));
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    zip.outputStream.on("error", reject);
  });
}

// Highly compressible content (all zero bytes) - compresses at a very high ratio, used to
// exercise the compression-ratio zip-bomb guard without needing gigabytes of real data.
export function highlyCompressibleBuffer(sizeBytes: number): Buffer {
  return Buffer.alloc(sizeBytes, 0);
}

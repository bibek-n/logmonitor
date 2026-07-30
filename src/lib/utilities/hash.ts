import { md5 } from "./md5";

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const HASH_ALGORITHMS: HashAlgorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];

async function webCryptoHashHex(algo: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512", input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(algo, bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeHash(algorithm: HashAlgorithm, input: string): Promise<string> {
  if (algorithm === "MD5") return md5(input);
  return webCryptoHashHex(algorithm, input);
}

export async function computeAllHashes(input: string): Promise<Record<HashAlgorithm, string>> {
  const entries = await Promise.all(HASH_ALGORITHMS.map(async (algo) => [algo, await computeHash(algo, input)] as const));
  return Object.fromEntries(entries) as Record<HashAlgorithm, string>;
}

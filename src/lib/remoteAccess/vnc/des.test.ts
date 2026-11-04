import { describe, expect, it } from "vitest";
import { desEcbEncrypt, vncAuthKey, vncAuthResponse } from "./des";

describe("desEcbEncrypt", () => {
  // Classic FIPS 46-3 / textbook DES known-answer test vector - independent of anything
  // VNC-specific, this just proves the core DES block cipher itself is implemented correctly.
  it("matches the standard DES known-answer test vector", () => {
    const key = Buffer.from("133457799BBCDFF1", "hex");
    const plaintext = Buffer.from("0123456789ABCDEF", "hex");
    const ciphertext = desEcbEncrypt(plaintext, key);
    expect(ciphertext.toString("hex").toLowerCase()).toBe("85e813540f0ab405");
  });

  it("encrypts each 8-byte block independently in ECB mode", () => {
    const key = Buffer.from("133457799BBCDFF1", "hex");
    const oneBlock = desEcbEncrypt(Buffer.from("0123456789ABCDEF", "hex"), key);
    const twoBlocks = desEcbEncrypt(Buffer.concat([Buffer.from("0123456789ABCDEF", "hex"), Buffer.from("0123456789ABCDEF", "hex")]), key);
    expect(twoBlocks.subarray(0, 8)).toEqual(oneBlock);
    expect(twoBlocks.subarray(8, 16)).toEqual(oneBlock);
  });

  it("rejects input that isn't a whole number of 8-byte blocks", () => {
    expect(() => desEcbEncrypt(Buffer.alloc(7), Buffer.alloc(8))).toThrow();
  });
});

describe("vncAuthKey", () => {
  it("reverses the bits of each key byte (RFB's documented VNC Authentication quirk)", () => {
    // 0x01 = 00000001 -> bit-reversed -> 10000000 = 0x80
    const key = vncAuthKey("\x01\x01\x01\x01\x01\x01\x01\x01");
    expect(key.every((b) => b === 0x80)).toBe(true);
  });

  it("null-pads passwords shorter than 8 bytes and truncates longer ones", () => {
    const short = vncAuthKey("ab");
    expect(short.subarray(2)).toEqual(Buffer.alloc(6, 0));
    const long = vncAuthKey("abcdefghij");
    expect(long).toHaveLength(8);
  });
});

describe("vncAuthResponse", () => {
  it("produces a 16-byte response for a 16-byte challenge", () => {
    const response = vncAuthResponse("secret", Buffer.alloc(16, 0x42));
    expect(response).toHaveLength(16);
  });

  it("is deterministic for the same password and challenge", () => {
    const challenge = Buffer.from("0011223344556677 8899aabbccddeeff".replace(" ", ""), "hex");
    expect(vncAuthResponse("hunter2", challenge)).toEqual(vncAuthResponse("hunter2", challenge));
  });

  it("differs when the password differs", () => {
    const challenge = Buffer.alloc(16, 0x11);
    expect(vncAuthResponse("secretAAA", challenge)).not.toEqual(vncAuthResponse("secretBBB", challenge));
  });
});

import { describe, expect, test } from "bun:test";

import { verifyEcdsaP256, verifySignature } from "./ecdsa-verify";

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const utf8 = (value: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(new TextEncoder().encode(value));

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const trimIntegerBytes = (bytes: Uint8Array): Uint8Array => {
  let start = 0;
  while (start < bytes.length - 1 && bytes[start] === 0) {
    start += 1;
  }
  return bytes.slice(start);
};

const encodeDerInteger = (bytes: Uint8Array): Uint8Array => {
  const trimmed = trimIntegerBytes(bytes);
  const needsLeadingZero = (trimmed[0] ?? 0) >= 0x80;
  const value = needsLeadingZero ? new Uint8Array([0, ...trimmed]) : trimmed;
  return new Uint8Array([0x02, value.length, ...value]);
};

/**
 * Web Crypto signs ECDSA messages as IEEE P1363 (`r || s`).
 * The transport format in the wallet RPC is ASN.1 DER, so the test mirrors the wire shape.
 */
const p1363ToDer = (signature: Uint8Array): Uint8Array => {
  if (signature.length !== 64) {
    throw new TypeError(`Expected 64-byte P1363 signature, received ${signature.length}`);
  }

  const r = encodeDerInteger(signature.slice(0, 32));
  const s = encodeDerInteger(signature.slice(32));
  return new Uint8Array([0x30, r.length + s.length, ...r, ...s]);
};

const generateEd25519KeyPair = async (): Promise<CryptoKeyPair> => {
  return (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
};

const exportRawPublicKeyHex = async (publicKey: CryptoKey): Promise<string> => {
  const rawPublicKey = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
  return bytesToHex(rawPublicKey);
};

const signEd25519MessageHex = async (privateKey: CryptoKey, message: string): Promise<string> => {
  const signature = new Uint8Array(await crypto.subtle.sign("Ed25519", privateKey, utf8(message)));
  return bytesToHex(signature);
};

describe("signature verification helpers", () => {
  test("verifies a fresh ECDSA P-256 signature", async () => {
    const keyPair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const message = "Hello from Canton dApp SDK demo";
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keyPair.privateKey,
        new TextEncoder().encode(message),
      ),
    );
    const publicKeySpki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));

    await expect(
      verifyEcdsaP256({
        publicKeySpkiB64: bytesToBase64(publicKeySpki),
        signatureDerHex: bytesToHex(p1363ToDer(signature)),
        message,
      }),
    ).resolves.toBe(true);
  });

  test("rejects a tampered message", async () => {
    const keyPair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const originalMessage = "Hello from Canton dApp SDK demo";
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        keyPair.privateKey,
        new TextEncoder().encode(originalMessage),
      ),
    );
    const publicKeySpki = new Uint8Array(await crypto.subtle.exportKey("spki", keyPair.publicKey));

    await expect(
      verifyEcdsaP256({
        publicKeySpkiB64: bytesToBase64(publicKeySpki),
        signatureDerHex: bytesToHex(p1363ToDer(signature)),
        message: `${originalMessage} (tampered)`,
      }),
    ).resolves.toBe(false);
  });

  test("rejects malformed hex signature", async () => {
    await expect(
      verifyEcdsaP256({
        publicKeySpkiB64: "not-real",
        signatureDerHex: "ZZ",
        message: "hello",
      }),
    ).rejects.toThrow();
  });

  test("verifies a wallet-simulator Ed25519 signature", async () => {
    const keyPair = await generateEd25519KeyPair();
    const message = "Hello from Canton dApp SDK demo";
    const publicKeyHex = await exportRawPublicKeyHex(keyPair.publicKey);
    const signatureHex = await signEd25519MessageHex(keyPair.privateKey, message);

    await expect(
      verifySignature({
        publicKey: publicKeyHex,
        signatureHex,
        message,
      }),
    ).resolves.toBe(true);
  });

  test("rejects a wallet-simulator Ed25519 signature for the wrong message", async () => {
    const keyPair = await generateEd25519KeyPair();
    const originalMessage = "Hello from Canton dApp SDK demo";
    const publicKeyHex = await exportRawPublicKeyHex(keyPair.publicKey);
    const signatureHex = await signEd25519MessageHex(keyPair.privateKey, originalMessage);

    await expect(
      verifySignature({
        publicKey: publicKeyHex,
        signatureHex,
        message: `${originalMessage} (tampered)`,
      }),
    ).resolves.toBe(false);
  });

  test("rejects a wallet-simulator Ed25519 signature for the wrong key", async () => {
    const signingKeyPair = await generateEd25519KeyPair();
    const wrongKeyPair = await generateEd25519KeyPair();
    const message = "Hello from Canton dApp SDK demo";
    const wrongPublicKeyHex = await exportRawPublicKeyHex(wrongKeyPair.publicKey);
    const signatureHex = await signEd25519MessageHex(signingKeyPair.privateKey, message);

    await expect(
      verifySignature({
        publicKey: wrongPublicKeyHex,
        signatureHex,
        message,
      }),
    ).resolves.toBe(false);
  });
});

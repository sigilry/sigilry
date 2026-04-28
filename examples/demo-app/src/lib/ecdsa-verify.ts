export interface EcdsaVerifyParams {
  /** Base64-encoded SPKI (SubjectPublicKeyInfo) public key, as returned in Account.publicKey */
  publicKeySpkiB64: string;
  /** Hex-encoded ASN.1 DER signature, as returned in SignMessageResult.signature */
  signatureDerHex: string;
  /** UTF-8 plaintext message that was signed */
  message: string;
}

type SignatureAlgorithm = "ecdsa-p256" | "ed25519";

export interface VerifySignatureParams {
  /** Public key string as exposed on Account.publicKey */
  publicKey: string;
  /** Hex-encoded signature, as returned in SignMessageResult.signature */
  signatureHex: string;
  /** UTF-8 plaintext message that was signed */
  message: string;
  /**
   * Optional algorithm hint for callers that already know the wallet format.
   * When omitted, verification falls back to the demo's current wire formats.
   */
  algorithm?: SignatureAlgorithm;
}

const HEX_PATTERN = /^[\da-f]+$/i;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const P256_COORDINATE_BYTES = 32;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

const invalidHexError = (reason: string): TypeError => {
  return new TypeError(`Invalid DER hex signature: ${reason}`);
};

const invalidEd25519PublicKeyError = (reason: string): TypeError => {
  return new TypeError(`Invalid Ed25519 public key: ${reason}`);
};

const invalidEd25519SignatureError = (reason: string): TypeError => {
  return new TypeError(`Invalid Ed25519 hex signature: ${reason}`);
};

const invalidBase64Error = (reason: string): TypeError => {
  return new TypeError(`Invalid base64 SPKI public key: ${reason}`);
};

function hexToBytes(
  hex: string,
  invalidValueError: (reason: string) => TypeError,
): Uint8Array<ArrayBuffer> {
  if (hex.length === 0) {
    throw invalidValueError("expected at least one byte");
  }

  if (hex.length % 2 !== 0) {
    throw invalidValueError("hex strings must contain an even number of characters");
  }

  if (!HEX_PATTERN.test(hex)) {
    throw invalidValueError("found a non-hex character");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let offset = 0; offset < hex.length; offset += 2) {
    bytes[offset / 2] = Number.parseInt(hex.slice(offset, offset + 2), 16);
  }
  return bytes;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  if (b64.length === 0) {
    throw invalidBase64Error("expected a non-empty string");
  }

  if (!BASE64_PATTERN.test(b64)) {
    throw invalidBase64Error("string is not valid RFC 4648 base64");
  }

  try {
    const binary = atob(b64);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw invalidBase64Error(reason);
  }
}

async function importPublicKey(publicKeySpkiB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b64ToBytes(publicKeySpkiB64),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

async function importEd25519PublicKey(publicKeyHex: string): Promise<CryptoKey> {
  const rawPublicKey = hexToBytes(publicKeyHex, invalidEd25519PublicKeyError);
  if (rawPublicKey.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw invalidEd25519PublicKeyError(`expected ${ED25519_PUBLIC_KEY_BYTES} bytes`);
  }

  return crypto.subtle.importKey("raw", rawPublicKey, { name: "Ed25519" }, false, ["verify"]);
}

function isEd25519PublicKeyHex(publicKey: string): boolean {
  return publicKey.length === ED25519_PUBLIC_KEY_BYTES * 2 && HEX_PATTERN.test(publicKey);
}

function detectSignatureAlgorithm(
  publicKey: string,
  algorithm?: SignatureAlgorithm,
): SignatureAlgorithm {
  if (algorithm) {
    return algorithm;
  }

  // The local wallet simulator publishes raw Ed25519 public keys as hex, while the original
  // demo verifier expected base64-encoded SPKI for ECDSA. Detecting by key shape keeps the demo
  // honest about both formats without changing the public account schema.
  if (isEd25519PublicKeyHex(publicKey)) {
    return "ed25519";
  }

  if (BASE64_PATTERN.test(publicKey) && publicKey.length > 0) {
    return "ecdsa-p256";
  }

  throw new Error("Signature verification failed: unsupported public key format");
}

function readDerLength(bytes: Uint8Array, offset: number): { length: number; nextOffset: number } {
  const first = bytes[offset];

  if (first === undefined) {
    throw new Error("Invalid DER signature: truncated length");
  }

  if ((first & 0x80) === 0) {
    return { length: first, nextOffset: offset + 1 };
  }

  const octets = first & 0x7f;
  if (octets === 0 || octets > 4) {
    throw new Error("Invalid DER signature: unsupported length encoding");
  }

  let length = 0;
  for (let index = 0; index < octets; index += 1) {
    const value = bytes[offset + 1 + index];
    if (value === undefined) {
      throw new Error("Invalid DER signature: truncated long-form length");
    }
    length = (length << 8) | value;
  }

  return { length, nextOffset: offset + 1 + octets };
}

function readDerInteger(
  bytes: Uint8Array<ArrayBuffer>,
  offset: number,
): { value: Uint8Array<ArrayBuffer>; nextOffset: number } {
  if (bytes[offset] !== 0x02) {
    throw new Error("Invalid DER signature: expected INTEGER");
  }

  const { length, nextOffset } = readDerLength(bytes, offset + 1);
  const endOffset = nextOffset + length;
  const value = bytes.slice(nextOffset, endOffset);

  if (value.length !== length) {
    throw new Error("Invalid DER signature: truncated INTEGER");
  }

  return { value, nextOffset: endOffset };
}

function normalizeP256Coordinate(component: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  let normalized = component;
  while (normalized.length > 1 && normalized[0] === 0) {
    normalized = normalized.slice(1);
  }

  if (normalized.length > P256_COORDINATE_BYTES) {
    throw new Error("Invalid DER signature: coordinate exceeds 32 bytes");
  }

  const out = new Uint8Array(P256_COORDINATE_BYTES);
  out.set(normalized, P256_COORDINATE_BYTES - normalized.length);
  return out;
}

function derToP1363(derBytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> {
  if (derBytes[0] !== 0x30) {
    throw new Error("Invalid DER signature: expected SEQUENCE");
  }

  const { length: sequenceLength, nextOffset: sequenceOffset } = readDerLength(derBytes, 1);
  const sequenceEnd = sequenceOffset + sequenceLength;
  if (sequenceEnd !== derBytes.length) {
    throw new Error("Invalid DER signature: trailing or truncated bytes");
  }

  const { value: r, nextOffset: sOffset } = readDerInteger(derBytes, sequenceOffset);
  const { value: s, nextOffset: finalOffset } = readDerInteger(derBytes, sOffset);
  if (finalOffset !== sequenceEnd) {
    throw new Error("Invalid DER signature: unexpected data after S value");
  }

  const out = new Uint8Array(P256_COORDINATE_BYTES * 2);
  out.set(normalizeP256Coordinate(r), 0);
  out.set(normalizeP256Coordinate(s), P256_COORDINATE_BYTES);
  return out;
}

async function verifyEd25519({
  publicKey,
  signatureHex,
  message,
}: VerifySignatureParams): Promise<boolean> {
  const signatureBytes = hexToBytes(signatureHex, invalidEd25519SignatureError);
  if (signatureBytes.length !== ED25519_SIGNATURE_BYTES) {
    throw invalidEd25519SignatureError(`expected ${ED25519_SIGNATURE_BYTES} bytes`);
  }

  const messageBytes = new TextEncoder().encode(message);

  try {
    const importedPublicKey = await importEd25519PublicKey(publicKey);
    return await crypto.subtle.verify("Ed25519", importedPublicKey, signatureBytes, messageBytes);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Ed25519 verification failed: ${reason}`);
  }
}

/**
 * Lifted from the canton-sign-message-demo gist into a typed module so React components can verify wallet signatures without copying Web Crypto plumbing.
 */
export async function verifyEcdsaP256({
  publicKeySpkiB64,
  signatureDerHex,
  message,
}: EcdsaVerifyParams): Promise<boolean> {
  const signatureP1363 = derToP1363(hexToBytes(signatureDerHex, invalidHexError));
  const messageBytes = new TextEncoder().encode(message);

  try {
    const publicKey = await importPublicKey(publicKeySpkiB64);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      signatureP1363,
      messageBytes,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`ECDSA verification failed: ${reason}`);
  }
}

export async function verifySignature(params: VerifySignatureParams): Promise<boolean> {
  const algorithm = detectSignatureAlgorithm(params.publicKey, params.algorithm);

  switch (algorithm) {
    case "ecdsa-p256":
      return verifyEcdsaP256({
        publicKeySpkiB64: params.publicKey,
        signatureDerHex: params.signatureHex,
        message: params.message,
      });
    case "ed25519":
      return verifyEd25519(params);
    default: {
      const exhaustive: never = algorithm;
      return exhaustive;
    }
  }
}

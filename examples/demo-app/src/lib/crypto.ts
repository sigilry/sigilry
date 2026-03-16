/* eslint-disable no-console */
import { useEffect, useState } from "react";

/**
 * Convert an ArrayBuffer to a hex string.
 */
export const bufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Compute a fingerprint from a CryptoKey public key.
 * Exports the raw public key, hashes it with SHA-256, hex-encodes, and slices to 68 chars.
 */
const computeFingerprint = async (publicKey: CryptoKey): Promise<string> => {
  const rawKey = await crypto.subtle.exportKey("raw", publicKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", rawKey);
  const hex = bufferToHex(hashBuffer);
  return hex.slice(0, 68);
};

/**
 * Construct a party ID from a fingerprint.
 */
const computePartyId = (fingerprint: string): string => {
  return `demo-wallet::${fingerprint}`;
};

export interface WalletIdentity {
  fingerprint: string | null;
  partyId: string | null;
  publicKeyHex: string | null;
  isLoading: boolean;
}

/**
 * React hook that computes wallet identity from a keypair.
 * Returns fingerprint, partyId, and publicKeyHex derived from the public key.
 */
export const useWalletIdentity = (keypair: CryptoKeyPair | null): WalletIdentity => {
  const [identity, setIdentity] = useState<WalletIdentity>({
    fingerprint: null,
    partyId: null,
    publicKeyHex: null,
    isLoading: false,
  });

  useEffect(() => {
    if (!keypair) {
      setIdentity({
        fingerprint: null,
        partyId: null,
        publicKeyHex: null,
        isLoading: false,
      });
      return;
    }

    let isActive = true;
    setIdentity((prev) => ({ ...prev, isLoading: true }));

    const computeIdentity = async () => {
      const rawKey = await crypto.subtle.exportKey("raw", keypair.publicKey);
      const publicKeyHex = bufferToHex(rawKey);
      const fingerprint = await computeFingerprint(keypair.publicKey);
      const partyId = computePartyId(fingerprint);

      if (isActive) {
        setIdentity({
          fingerprint,
          partyId,
          publicKeyHex,
          isLoading: false,
        });
      }
    };

    computeIdentity().catch((err) => {
      if (isActive) {
        console.error("Failed to compute wallet identity:", err);
        setIdentity({
          fingerprint: null,
          partyId: null,
          publicKeyHex: null,
          isLoading: false,
        });
      }
    });

    return () => {
      isActive = false;
    };
  }, [keypair]);

  return identity;
};

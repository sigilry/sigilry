/* eslint-disable no-console */
import React, { createContext, useEffect, useMemo, useState } from "react";

import { ApprovalQueue, useApprovalQueue } from "../lib/approval-queue";
import type { WalletIdentity } from "../lib/crypto";
import { useWalletIdentity } from "../lib/crypto";
import { resolveUserParty } from "../lib/ledger-http";
import { createChangeGate } from "../lib/logging";
import { LEDGER_API_BASE_PATH, LEDGER_PARTY_ID, LEDGER_USER_ID, NETWORK_ID } from "./demoWallet";
import type { MockProvider } from "./MockProvider";

interface WalletSimulatorState {
  keypair: CryptoKeyPair | null;
  isGenerating: boolean;
  error: string | null;
  approvalQueue: ApprovalQueue;
  identity: WalletIdentity;
  networkId: string;
}

export const WalletSimulatorContext = createContext<WalletSimulatorState | null>(null);

interface WalletSimulatorProviderProps {
  // The simulated wallet provider, constructed and installed onto window.canton in main.tsx so
  // the dApp side can discover it. This component owns its runtime wiring (keypair, accounts,
  // approval queue), not its lifecycle.
  provider: MockProvider;
  children: React.ReactNode;
}

const logPartyResolutionStateChange = createChangeGate();

export const WalletSimulatorProvider = ({ provider, children }: WalletSimulatorProviderProps) => {
  const approvalQueue = useApprovalQueue();
  const [keypair, setKeypair] = useState<CryptoKeyPair | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedPartyId, setResolvedPartyId] = useState<string | null>(null);

  const mockProvider = provider;

  const identity = useWalletIdentity(keypair);

  useEffect(() => {
    mockProvider.setApprovalQueue(approvalQueue);
  }, [approvalQueue, mockProvider]);

  useEffect(() => {
    mockProvider.setKeypair(keypair);
  }, [keypair, mockProvider]);

  // Resolve full party ID (Alice::namespace) from the Ledger API.
  // The bootstrap script runs after sandbox start (~10-15s), so poll until the user exists.
  useEffect(() => {
    let active = true;
    const POLL_INTERVAL_MS = 3000;

    const poll = async () => {
      while (active) {
        try {
          const fullId = await resolveUserParty(LEDGER_USER_ID, {
            basePath: LEDGER_API_BASE_PATH,
          });
          if (active) {
            if (logPartyResolutionStateChange("wallet:party-resolution", `resolved:${fullId}`)) {
              console.debug("[wallet] resolved full party ID", fullId);
            }
            setResolvedPartyId(fullId);
          }
          return;
        } catch {
          if (logPartyResolutionStateChange("wallet:party-resolution", "pending")) {
            console.debug(
              "[wallet] party resolution pending; will retry every %dms",
              POLL_INTERVAL_MS,
            );
          }
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        }
      }
    };

    poll();
    return () => {
      active = false;
    };
  }, []);

  // Update MockProvider accounts when identity and full party ID are both available.
  // resolvedPartyId contains the full qualified ID (e.g. "Alice::12209e421cb8...") so both
  // actAs and template payload fields (owner, etc.) use the same value.
  useEffect(() => {
    if (identity.publicKeyHex && resolvedPartyId) {
      console.debug("[wallet] identity ready", {
        derivedPartyId: identity.partyId,
        resolvedPartyId,
        fingerprint: identity.fingerprint,
      });
      mockProvider.setAccounts([
        {
          primary: true,
          partyId: resolvedPartyId,
          status: "allocated",
          hint: LEDGER_PARTY_ID,
          publicKey: identity.publicKeyHex,
          namespace: "",
          networkId: NETWORK_ID,
          signingProviderId: "demo-signer",
        },
      ]);
    }
  }, [
    mockProvider,
    resolvedPartyId,
    identity.partyId,
    identity.fingerprint,
    identity.publicKeyHex,
  ]);

  useEffect(() => {
    let isActive = true;

    const generateKeypair = async () => {
      // The simulator creates an Ed25519 keypair locally, then derives a deterministic
      // demo party identifier from the public key fingerprint (see useWalletIdentity).
      // Web Crypto is required for Ed25519 keys; localhost is treated as secure.
      if (!globalThis.isSecureContext || !window.crypto?.subtle) {
        if (isActive) {
          console.debug("[wallet] Ed25519 unsupported or insecure context");
          setError("Ed25519 unsupported");
          setKeypair(null);
          setIsGenerating(false);
        }
        return;
      }

      setIsGenerating(true);

      try {
        console.debug("[wallet] generating Ed25519 keypair");
        const generated = (await window.crypto.subtle.generateKey({ name: "Ed25519" }, true, [
          "sign",
          "verify",
        ])) as CryptoKeyPair;

        if (!isActive) {
          return;
        }

        console.debug("[wallet] keypair generated");
        setKeypair(generated);
        setError(null);
      } catch {
        if (!isActive) {
          return;
        }

        console.debug("[wallet] keypair generation failed");
        setError("Ed25519 unsupported");
        setKeypair(null);
      } finally {
        if (isActive) {
          setIsGenerating(false);
        }
      }
    };

    generateKeypair();

    return () => {
      isActive = false;
    };
  }, []);

  const value = useMemo<WalletSimulatorState>(
    () => ({
      keypair,
      isGenerating,
      error,
      approvalQueue,
      identity,
      networkId: NETWORK_ID,
    }),
    [approvalQueue, error, identity, isGenerating, keypair],
  );

  return (
    <WalletSimulatorContext.Provider value={value}>{children}</WalletSimulatorContext.Provider>
  );
};

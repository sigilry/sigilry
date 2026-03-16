import { useContext } from "react";

import { WalletSimulatorContext } from "../providers/WalletSimulator";

export const useWalletSimulator = () => {
  const context = useContext(WalletSimulatorContext);

  if (!context) {
    throw new Error("useWalletSimulator must be used within a WalletSimulatorProvider");
  }

  const { keypair, isGenerating, error, approvalQueue, identity, networkId } = context;

  return {
    keypair,
    isGenerating,
    error,
    approvalQueue,
    identity,
    networkId,
  };
};

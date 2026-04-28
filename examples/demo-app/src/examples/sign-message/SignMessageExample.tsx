import { useState } from "react";
import { useActiveAccount, useConnect, useSignMessage } from "@sigilry/react";

import { StatusPill } from "../../components/shared/StatusPill";
import { verifySignature } from "../../lib/ecdsa-verify";
import { shortenPartyId } from "../../lib/format";

const DEFAULT_MESSAGE = "Hello from Canton dApp SDK demo";

interface SignedPayload {
  partyId: string;
  message: string;
  signature: string;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "signing" }
  | { kind: "verifying"; payload: SignedPayload }
  | { kind: "valid"; payload: SignedPayload }
  | { kind: "invalid"; payload: SignedPayload }
  | { kind: "error"; message: string; payload?: SignedPayload };

const previewPublicKey = (publicKey: string): string => {
  if (publicKey.length <= 28) {
    return publicKey;
  }
  return `${publicKey.slice(0, 16)}...${publicKey.slice(-12)}`;
};

const getConnectionStatus = (
  isConnected: boolean,
  isConnectPending: boolean,
  hasError: boolean,
): "connected" | "connecting" | "error" | "disconnected" => {
  if (isConnected) {
    return "connected";
  }
  if (isConnectPending) {
    return "connecting";
  }
  if (hasError) {
    return "error";
  }
  return "disconnected";
};

const getVerificationPill = (
  state: VerifyState,
): {
  status: "approved" | "pending" | "error" | "disconnected";
  label: string;
  description: string;
} => {
  switch (state.kind) {
    case "idle":
      return {
        status: "disconnected",
        label: "idle",
        description: "Submit a message to request a wallet signature and verify it locally.",
      };
    case "signing":
      return {
        status: "pending",
        label: "signing",
        description: "Waiting for the wallet to approve and return a signature.",
      };
    case "verifying":
      return {
        status: "pending",
        label: "verifying",
        description: "The signature is back from the wallet and is being checked with Web Crypto.",
      };
    case "valid":
      return {
        status: "approved",
        label: "✓ valid",
        description: "The signature verified against the active account's public key.",
      };
    case "invalid":
      return {
        status: "error",
        label: "✗ invalid",
        description: "The wallet returned a signature, but it did not verify for this message.",
      };
    case "error":
      return {
        status: "error",
        label: "error",
        description: state.message,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const SignMessageExample = () => {
  const {
    connect,
    isPending: isConnectPending,
    isError: isConnectError,
    error: connectError,
  } = useConnect();
  const activeAccount = useActiveAccount();
  const { signMessageAsync, isPending: isSignPending, error: signError } = useSignMessage();
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [state, setState] = useState<VerifyState>({ kind: "idle" });

  const connectionStatus = getConnectionStatus(
    activeAccount.isConnected,
    isConnectPending,
    isConnectError || activeAccount.isError,
  );
  const verificationPill = getVerificationPill(state);
  const isBusy = isSignPending || state.kind === "signing" || state.kind === "verifying";
  const isActionDisabled = isBusy || !activeAccount.data || message.trim().length === 0;
  const resultPayload =
    state.kind === "signing" || state.kind === "idle" ? null : (state.payload ?? null);

  const onSign = async () => {
    const account = activeAccount.data;
    if (!account) {
      return;
    }

    const payloadBase = {
      partyId: account.partyId,
      message,
    };
    let payload: SignedPayload | undefined;

    setState({ kind: "signing" });

    try {
      const { signature } = await signMessageAsync({ message });
      payload = { ...payloadBase, signature };
      setState({ kind: "verifying", payload });

      const isValid = await verifySignature({
        publicKey: account.publicKey,
        signatureHex: signature,
        message,
      });

      setState({ kind: isValid ? "valid" : "invalid", payload });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      setState({ kind: "error", message: messageText, payload });
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Connect State</h3>
            <p className="muted">
              The example uses `useConnect` and `useActiveAccount` instead of direct wallet RPC.
            </p>
          </div>
          <StatusPill
            status={connectionStatus}
            label={connectionStatus.replace("_", " ")}
            description="Connection state comes from the React provider and active account hook."
          />
        </div>
        <div className="stat">
          <span className="label">Party ID</span>
          <span className="value mono" title={activeAccount.partyId ?? undefined}>
            {activeAccount.partyId ? shortenPartyId(activeAccount.partyId) : "Not connected"}
          </span>
        </div>
        <div className="stat">
          <span className="label">Public key</span>
          <span className="value mono" title={activeAccount.data?.publicKey}>
            {activeAccount.data ? previewPublicKey(activeAccount.data.publicKey) : "—"}
          </span>
        </div>
        {!activeAccount.isConnected ? (
          <div className="button-row">
            <button type="button" onClick={connect} disabled={isConnectPending}>
              {isConnectPending ? "Connecting..." : "Connect wallet"}
            </button>
          </div>
        ) : null}
        {connectError ? <p className="error">{connectError.message}</p> : null}
        {activeAccount.error ? <p className="error">{activeAccount.error.message}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Sign Request</h3>
            <p className="muted">
              `useSignMessage` opens the wallet approval flow, then the example verifies the
              returned signature locally.
            </p>
          </div>
        </div>
        <div className="form">
          <label className="field">
            <span>Message</span>
            <input
              type="text"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
              }}
              placeholder={DEFAULT_MESSAGE}
            />
          </label>
          <button type="button" onClick={onSign} disabled={isActionDisabled}>
            {state.kind === "verifying"
              ? "Verifying..."
              : isSignPending || state.kind === "signing"
                ? "Signing..."
                : "Sign & Verify"}
          </button>
        </div>
        <p className="helper muted">
          The signed payload stays in the result panel so edits to the input do not rewrite the
          verification history after the fact.
        </p>
        {signError ? <p className="error">{signError.message}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Verification Result</h3>
            <p className="muted">
              The browser checks the wallet signature with `crypto.subtle.verify(...)` using the
              active account's public key.
            </p>
          </div>
          <StatusPill
            status={verificationPill.status}
            label={verificationPill.label}
            description={verificationPill.description}
          />
        </div>
        {resultPayload ? (
          <>
            <div className="stat">
              <span className="label">Party</span>
              <span className="value mono" title={resultPayload.partyId}>
                {shortenPartyId(resultPayload.partyId)}
              </span>
            </div>
            <div className="stat inline">
              <span className="label">Message</span>
              <span className="value">{resultPayload.message}</span>
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <span className="label">Signature</span>
              <pre>
                <code className="mono">{resultPayload.signature}</code>
              </pre>
            </div>
          </>
        ) : (
          <p className="muted">No signature captured yet.</p>
        )}
        {state.kind === "error" ? <p className="error">{state.message}</p> : null}
      </section>
    </div>
  );
};

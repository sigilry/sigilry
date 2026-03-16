import { useWalletSimulator } from "../../hooks/useWalletSimulator";
import { CopyableText } from "../shared/CopyableText";
import { InfoTooltip } from "../shared/InfoTooltip";
import { StatusPill } from "../shared/StatusPill";
import { docsLinks } from "../../lib/docs";
import { shortenPartyId } from "../../lib/format";

export const KeypairDisplay = () => {
  const { keypair, isGenerating, error, identity } = useWalletSimulator();
  const { partyId, publicKeyHex } = identity;
  const statusLabel = error
    ? "Unsupported"
    : isGenerating
      ? "Generating"
      : keypair
        ? "Ready"
        : "Unavailable";

  if (error) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div className="title-row">
            <h3>Keypair</h3>
            <InfoTooltip
              label="Wallet keypair"
              description="The wallet generates an Ed25519 keypair in-browser to sign Canton requests."
              href={docsLinks.architecture}
            />
          </div>
          <StatusPill
            status="error"
            label={statusLabel}
            description="Ed25519 is not available in this browser context."
            href={docsLinks.architecture}
          />
        </div>
        <p className="muted">Ed25519 is not available in this browser context.</p>
      </section>
    );
  }

  if (isGenerating) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div className="title-row">
            <h3>Keypair</h3>
            <InfoTooltip
              label="Wallet keypair"
              description="The wallet generates an Ed25519 keypair in-browser to sign Canton requests."
              href={docsLinks.architecture}
            />
          </div>
          <StatusPill
            status="connecting"
            label={statusLabel}
            description="Generating an Ed25519 keypair in the browser for signing Canton requests."
            href={docsLinks.architecture}
          />
        </div>
        <p className="muted">Generating Ed25519 keypair on this device...</p>
      </section>
    );
  }

  if (!keypair) {
    return (
      <section className="panel">
        <div className="panel-header">
          <div className="title-row">
            <h3>Keypair</h3>
            <InfoTooltip
              label="Wallet keypair"
              description="The wallet generates an Ed25519 keypair in-browser to sign Canton requests."
              href={docsLinks.architecture}
            />
          </div>
          <StatusPill
            status="disconnected"
            label={statusLabel}
            description="No keypair available. The wallet needs to generate a keypair before signing."
            href={docsLinks.architecture}
          />
        </div>
        <p className="muted">No keypair available.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div className="title-row">
          <h3>Keypair</h3>
          <InfoTooltip
            label="Wallet keypair"
            description="The wallet generates an Ed25519 keypair in-browser to sign Canton requests."
            href={docsLinks.architecture}
          />
        </div>
        <StatusPill
          status="connected"
          label={statusLabel}
          description="Ed25519 keypair generated. The wallet can sign Canton requests."
          href={docsLinks.architecture}
        />
      </div>
      <div className="stat">
        <span className="label">Party ID</span>
        <span className="value">
          {partyId ? (
            <CopyableText
              value={partyId}
              displayValue={shortenPartyId(partyId)}
              label="party id"
              textClassName="mono"
            />
          ) : (
            "unknown"
          )}
        </span>
      </div>
      <div className="stat">
        <span className="label">Public key</span>
        <span className="value">
          {publicKeyHex ? (
            <CopyableText value={publicKeyHex} label="public key" textClassName="mono" />
          ) : (
            "-"
          )}
        </span>
      </div>
    </section>
  );
};
